# AcademiaX — Course Enrollment & Tuition Processing (PS035)

Microservices platform for course registration, seat reservation and tuition payment.

```
frontend/            Next.js + TypeScript web app                      :3000
api-gateway/         Spring Cloud Gateway (routing, CORS, correlation)  :8080
eureka-server/       Netflix Eureka service registry                    :8761
auth-service/        Login, JWT, users (Spring Security, BCrypt)        :8081
course-service/      Catalog, capacity, deadlines, atomic seat holds    :8082
enrollment-service/  Enrollment workflow, idempotency, compensation     :8083
payment-service/     Tuition payments, enrollment confirmation          :8084
common/              Shared JWT filter, errors, audit, service client
```

Stack: Java 25 · Spring Boot 4.0 · Spring Cloud 2025.1 · PostgreSQL · Flyway · JJWT · springdoc OpenAPI.

## How the critical rules are enforced

| Rule | Where |
|---|---|
| No overbooking | `UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE … AND enrolled_count < capacity` plus a `CHECK (enrolled_count <= capacity)` constraint (course-service) |
| Deadline | Same atomic update requires `enrollment_deadline > now()`; rejected with **422** |
| Duplicate enrollment | Partial unique index on `(student_id, course_id) WHERE status IN ('PENDING','CONFIRMED')` → **409** |
| Idempotency | `Idempotency-Key` header on `POST /api/enrollments` and `POST /api/payments`; seat holds are keyed by enrollment ID so retries never take a second seat |
| Payment integrity | One `SUCCEEDED` and one `PROCESSING` payment per enrollment (partial unique indexes); results are stored before notifying enrollment-service and retried until delivered |
| Compensation | Failed/expired payments and cancellations release the seat; releases retry until course-service accepts them |
| Security | JWT validated in every service (`@PreAuthorize` role/ownership checks); `/internal/**` requires a SYSTEM token and is not routed by the gateway; login rate limiting |
| Audit | `audit_events` rows + structured `AUDIT` log lines with correlation IDs |

Each service owns a separate PostgreSQL schema (`auth`, `course`, `enrollment`, `payment`) created by Flyway.

## Run locally (Windows, no Docker)

Requirements: JDK 25, PostgreSQL running on `localhost:5432`, Node 20+.

```powershell
Copy-Item .env.example .env      # set DB_PASSWORD (and JWT_SECRET)
.\run-local.ps1                  # builds and starts Eureka, services, gateway
```

Then point the web app at the gateway and start it:

```powershell
Set-Content frontend\.env.local "NEXT_PUBLIC_API_URL=http://localhost:8080"
npm --prefix frontend run dev    # http://localhost:3000
```

Stop the backend with `.\run-local.ps1 -Stop`. Without `frontend/.env.local` the web app runs in standalone demo mode.

Demo accounts (seeded when `SEED_DEMO_DATA=true`, password `password123`):
`student@academiax.edu`, `instructor@academiax.edu`, `admin@academiax.edu`.

## Run with Docker

```bash
cp .env.example .env   # set DB_PASSWORD and JWT_SECRET
docker compose up --build
```

Starts PostgreSQL, Eureka, the gateway, two instances each of course, enrollment and payment services, and the web app.

## Tests

```powershell
mvn install                                  # unit tests (JWT tampering/expiry, enrollment compensation)
$env:DB_PASSWORD="…"; mvn -pl course-service test   # + concurrency test against PostgreSQL
```

The concurrency test fires 40 simultaneous reservations at a 5-seat course and asserts exactly 5 succeed.

## API (through the gateway)

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| GET | `/api/users/me` · `/api/users` · PATCH `/api/users/{id}/status` | Authenticated · Admin · Admin |
| GET | `/api/courses` · `/api/courses/{id}` · `/api/courses/mine` | Authenticated · Authenticated · Instructor |
| POST / PUT | `/api/courses` · `/api/courses/{id}` | Instructor/Admin · Owner/Admin |
| POST | `/api/enrollments` (Idempotency-Key) · `/api/enrollments/{id}/cancel` | Student |
| GET | `/api/enrollments/me` · `/api/enrollments` · `/api/enrollments/{id}` | Student · Instructor/Admin · Owner/Admin |
| POST | `/api/payments` (Idempotency-Key) | Student |
| GET | `/api/payments/me` · `/api/payments` · `/api/payments/{id}` | Student · Admin · Owner/Admin |

Swagger UI per service: `http://localhost:808x/swagger-ui.html`. Errors use one shape:
`{ "status", "error", "message", "correlationId", "timestamp" }`.
