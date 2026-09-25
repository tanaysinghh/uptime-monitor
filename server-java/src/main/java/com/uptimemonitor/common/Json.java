package com.uptimemonitor.common;

import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Converts entities to plain maps using the application's JSON settings. Used where a
 * response embeds an association the way Sequelize's {@code include} did, e.g. an
 * incident with {@code "Monitor": {"name": ...}}.
 */
@Component
public class Json {

    private static final TypeReference<LinkedHashMap<String, Object>> MAP = new TypeReference<>() {
    };

    private final JsonMapper mapper;

    public Json(JsonMapper mapper) {
        this.mapper = mapper;
    }

    public Map<String, Object> toMap(Object value) {
        return mapper.convertValue(value, MAP);
    }

    /** Entity as a map plus one embedded association under {@code key}. */
    public Map<String, Object> withAssociation(Object entity, String key, Object association) {
        Map<String, Object> map = toMap(entity);
        map.put(key, association);
        return map;
    }

    public List<Map<String, Object>> toMaps(List<?> values) {
        return values.stream().map(this::toMap).toList();
    }
}
