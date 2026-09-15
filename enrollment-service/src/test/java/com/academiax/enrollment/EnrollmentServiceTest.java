package com.academiax.enrollment;

import com.academiax.common.audit.AuditService;
import com.academiax.common.security.AuthUser;
import com.academiax.common.web.ApiException;
import com.academiax.common.web.ServiceClient;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EnrollmentServiceTest {

    final EnrollmentRepository repo = mock(EnrollmentRepository.class);
    final ServiceClient client = mock(ServiceClient.class);
    final TransactionTemplate tx = mock(TransactionTemplate.class);
    final EnrollmentService service = new EnrollmentService(repo, client, mock(AuditService.class), tx, Duration.ofMinutes(30));

    final AuthUser student = new AuthUser(UUID.randomUUID(), "Priya", "p@academiax.edu", "STUDENT");
    final UUID courseId = UUID.randomUUID();
    final EnrollmentService.CourseRef course = new EnrollmentService.CourseRef(courseId, "CS240", "Distributed Systems", UUID.randomUUID(), new BigDecimal("1650.00"));

    @Test
    void replayedIdempotencyKeyReturnsOriginalWithoutTakingAnotherSeat() {
        var original = new Enrollment(UUID.randomUUID(), student, course, "key-12345");
        when(repo.findByStudentIdAndIdempotencyKey(student.id(), "key-12345")).thenReturn(Optional.of(original));

        assertThat(service.create(student, courseId, "key-12345")).isSameAs(original);
        verifyNoInteractions(client);
    }

    @Test
    void duplicateActiveEnrollmentIsRejectedBeforeReserving() {
        when(repo.findByStudentIdAndIdempotencyKey(any(), any())).thenReturn(Optional.empty());
        when(repo.existsByStudentIdAndCourseIdAndStatusIn(eq(student.id()), eq(courseId), any())).thenReturn(true);

        assertThatThrownBy(() -> service.create(student, courseId, "key-12345"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(client);
    }

    @Test
    void releasesSeatWhenLocalInsertLosesRace() {
        when(repo.findByStudentIdAndIdempotencyKey(any(), any())).thenReturn(Optional.empty());
        when(client.post(contains("/reserve/"), isNull(), eq(EnrollmentService.CourseRef.class))).thenReturn(course);
        doThrow(new DataIntegrityViolationException("ux_enrollments_active")).when(tx).execute(any());

        assertThatThrownBy(() -> service.create(student, courseId, "key-12345"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT));
        verify(client).post(contains("/courses/" + courseId + "/release/"), isNull(), eq(Object.class));
    }

    @Test
    void retriesReserveOnceAfterTimeoutThenCompensates() {
        when(repo.findByStudentIdAndIdempotencyKey(any(), any())).thenReturn(Optional.empty());
        when(client.post(contains("/reserve/"), isNull(), eq(EnrollmentService.CourseRef.class))).thenThrow(new ResourceAccessException("timeout"));

        assertThatThrownBy(() -> service.create(student, courseId, "key-12345")).isInstanceOf(ResourceAccessException.class);
        verify(client, times(2)).post(contains("/reserve/"), isNull(), eq(EnrollmentService.CourseRef.class));
        verify(client).post(contains("/release/"), isNull(), eq(Object.class));
    }
}
