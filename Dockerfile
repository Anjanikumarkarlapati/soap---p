# One image recipe for every Spring Boot service:
#   docker build --build-arg SERVICE=course-service -t academiax/course-service .
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml .
COPY common/pom.xml common/
COPY eureka-server/pom.xml eureka-server/
COPY api-gateway/pom.xml api-gateway/
COPY auth-service/pom.xml auth-service/
COPY course-service/pom.xml course-service/
COPY enrollment-service/pom.xml enrollment-service/
COPY payment-service/pom.xml payment-service/
RUN mvn -B -q dependency:go-offline -DexcludeReactor=true || true
COPY . .
ARG SERVICE
RUN mvn -B -q -pl ${SERVICE} -am package -DskipTests && cp ${SERVICE}/target/${SERVICE}-*.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 app
USER app
COPY --from=build /app.jar /app/app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
