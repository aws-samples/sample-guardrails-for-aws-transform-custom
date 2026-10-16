package com.example.demo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

@RestController
public class GreetingController {

    private final GreetingService service;

    public GreetingController(GreetingService service) {
        this.service = service;
    }

    // javax.servlet.http.HttpServletRequest -> jakarta.servlet.* on upgrade
    @GetMapping("/api/greeting")
    public Greeting greeting(@RequestParam(defaultValue = "World") String name,
                             HttpServletRequest request) {
        return service.greet(name);
    }
}
