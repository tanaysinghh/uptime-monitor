package com.uptimemonitor.web;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/errorResponse.test.js. */
class GlobalExceptionHandlerTest {

    private static GlobalExceptionHandler handler(String env) {
        return new GlobalExceptionHandler(new AppProperties(env, "http://localhost:5173", false, null, null,
                new AppProperties.RateLimit(false), new AppProperties.Scheduler(false),
                new AppProperties.Socket(false, 0)));
    }

    @Test
    void developmentExposesTheMessage() {
        var r = handler("development").unhandled(new IllegalStateException("db exploded"), new MockHttpServletRequest());
        assertThat(r.getStatusCode().value()).isEqualTo(500);
        assertThat(r.getBody()).containsEntry("error", "db exploded");
    }

    @Test
    void productionHides5xxMessages() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(RequestIdFilter.ATTRIBUTE, "req-12345678");
        var r = handler("production").unhandled(new IllegalStateException("db exploded"), request);
        assertThat(r.getBody()).containsEntry("error", "Internal server error").containsEntry("requestId", "req-12345678");
    }

    @Test
    void productionPassesClientErrorMessagesThrough() {
        var r = handler("production").api(new ApiException(400, "bad input"));
        assertThat(r.getStatusCode().value()).isEqualTo(400);
        assertThat(r.getBody()).containsEntry("error", "bad input");
    }
}
