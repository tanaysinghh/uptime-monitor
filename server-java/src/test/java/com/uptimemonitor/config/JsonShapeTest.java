package com.uptimemonitor.config;

import com.uptimemonitor.common.Json;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.support.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JSON must look like the Node server's JSON.stringify output: null values are kept (only
 * absent keys are omitted) and dates are Date#toISOString strings.
 */
class JsonShapeTest extends ApiTestBase {

    @Autowired
    Json json;

    @Test
    void nullMapValuesAreSerialized() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sslInfo", null);
        m.put("nested", new HashMap<>(Map.of("a", 1)));
        ((Map<String, Object>) m.get("nested")).put("b", null);
        assertThat(mapper.writeValueAsString(m)).isEqualTo("{\"sslInfo\":null,\"nested\":{\"a\":1,\"b\":null}}");
        assertThat(json.toMap(m)).containsKey("sslInfo");
    }

    @Test
    void nullEntityFieldsAreSerialized() {
        Incident i = new Incident();
        Map<String, Object> m = json.toMap(i);
        assertThat(m).containsKeys("resolvedAt", "durationSeconds");
        assertThat(m.get("resolvedAt")).isNull();
    }

    @Test
    void entityKeysKeepDeclarationOrderWithIdFirst() {
        String serialized = mapper.writeValueAsString(new Incident());
        assertThat(serialized).startsWith("{\"id\":");
        assertThat(serialized.indexOf("\"monitorId\"")).isLessThan(serialized.indexOf("\"status\""));
    }

    @Test
    void instantsUseJavascriptIsoFormat() {
        assertThat(mapper.writeValueAsString(Map.of("t", Instant.parse("2026-01-02T03:04:05Z"))))
                .isEqualTo("{\"t\":\"2026-01-02T03:04:05.000Z\"}");
    }
}
