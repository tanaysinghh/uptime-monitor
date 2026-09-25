package com.uptimemonitor.realtime;

import com.corundumstudio.socketio.protocol.JacksonJsonSupport;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * netty-socketio's default JSON support drops null values (Include.NON_NULL). The Node
 * server's payloads keep them (e.g. check:result always has "sslInfo" and
 * "errorMessage"), so restore Jackson's default inclusion.
 */
class NullPreservingJsonSupport extends JacksonJsonSupport {

    @Override
    protected void init(ObjectMapper objectMapper) {
        super.init(objectMapper);
        objectMapper.setDefaultPropertyInclusion(
                JsonInclude.Value.construct(JsonInclude.Include.ALWAYS, JsonInclude.Include.ALWAYS));
    }
}
