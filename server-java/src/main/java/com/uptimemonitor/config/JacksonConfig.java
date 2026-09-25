package com.uptimemonitor.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.StdSerializer;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Configuration
public class JacksonConfig {

    /**
     * Serialize timestamps exactly like JavaScript's Date#toISOString()
     * ("2026-01-02T03:04:05.678Z"), which is what the Node API returned.
     */
    @Bean
    JsonMapperBuilderCustomizer isoInstantCustomizer() {
        SimpleModule module = new SimpleModule("js-date");
        module.addSerializer(Instant.class, new JsIsoInstantSerializer());
        return builder -> builder.addModule(module);
    }

    static final class JsIsoInstantSerializer extends StdSerializer<Instant> {
        private static final DateTimeFormatter FORMAT =
                DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

        JsIsoInstantSerializer() {
            super(Instant.class);
        }

        @Override
        public void serialize(Instant value, JsonGenerator gen, SerializationContext ctxt) {
            gen.writeString(FORMAT.format(value));
        }
    }
}
