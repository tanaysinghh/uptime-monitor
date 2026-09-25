package com.uptimemonitor.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
public abstract class ApiTestBase {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JsonMapper mapper;

    protected TestApi api;

    @BeforeEach
    void setUpApi() {
        api = new TestApi(mvc, mapper);
    }
}
