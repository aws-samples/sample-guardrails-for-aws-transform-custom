package com.example.demo;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// JUnit 4 (@RunWith/SpringRunner) -> JUnit 5 (@ExtendWith/SpringExtension) on upgrade
@RunWith(SpringRunner.class)
@SpringBootTest
@AutoConfigureMockMvc
public class GreetingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void contextLoads() {
    }

    @Test
    public void returnsGreeting() throws Exception {
        mockMvc.perform(get("/api/greeting").param("name", "World"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Hello, World!"));
    }
}
