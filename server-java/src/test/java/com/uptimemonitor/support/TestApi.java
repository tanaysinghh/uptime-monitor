package com.uptimemonitor.support;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

/** Small MockMvc wrapper: JSON in, (status, JSON) out, optional bearer token. */
public class TestApi {

    public static final String STRONG_PASSWORD = "Tr0ub4dor&3xample!";

    public record Response(int status, JsonNode body, MvcResult raw) {
        public String error() {
            return body.path("error").asString();
        }

        public String header(String name) {
            return raw.getResponse().getHeader(name);
        }
    }

    public record Registered(String accessToken, String refreshToken, String userId, String organizationId,
                             String slug, String email) {
    }

    private final MockMvc mvc;
    private final JsonMapper mapper;

    public TestApi(MockMvc mvc, JsonMapper mapper) {
        this.mvc = mvc;
        this.mapper = mapper;
    }

    public Response get(String path) throws Exception {
        return get(path, null);
    }

    public Response get(String path, String token) throws Exception {
        return exec(auth(MockMvcRequestBuilders.get(path), token));
    }

    public Response post(String path, Object body) throws Exception {
        return post(path, body, null);
    }

    public Response post(String path, Object body, String token) throws Exception {
        return exec(json(auth(MockMvcRequestBuilders.post(path), token), body));
    }

    public Response put(String path, Object body, String token) throws Exception {
        return exec(json(auth(MockMvcRequestBuilders.put(path), token), body));
    }

    public Response delete(String path, String token) throws Exception {
        return exec(auth(MockMvcRequestBuilders.delete(path), token));
    }

    public Response exec(MockHttpServletRequestBuilder request) throws Exception {
        MvcResult result = mvc.perform(request).andReturn();
        String content = result.getResponse().getContentAsString();
        JsonNode body = content.isEmpty() ? mapper.createObjectNode() : safeParse(content);
        return new Response(result.getResponse().getStatus(), body, result);
    }

    private JsonNode safeParse(String content) {
        try {
            return mapper.readTree(content);
        } catch (RuntimeException e) {
            return mapper.createObjectNode().put("raw", content);
        }
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, Object body) {
        builder.contentType(MediaType.APPLICATION_JSON);
        if (body != null) {
            builder.content(body instanceof String s ? s : mapper.writeValueAsString(body));
        }
        return builder;
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return builder;
    }

    /** Registers a new user + organization with unique names and returns its tokens. */
    public Registered register() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "user-" + suffix + "@example.com";
        Response r = post("/api/auth/register", Map.of(
                "email", email,
                "password", STRONG_PASSWORD,
                "name", "User " + suffix,
                "orgName", "Org " + suffix));
        if (r.status() != 201) {
            throw new IllegalStateException("register failed: " + r.status() + " " + r.body());
        }
        JsonNode user = r.body().get("user");
        return new Registered(r.body().get("accessToken").asString(), r.body().get("refreshToken").asString(),
                user.get("id").asString(), user.get("organizationId").asString(),
                user.get("organization").get("slug").asString(), email);
    }
}
