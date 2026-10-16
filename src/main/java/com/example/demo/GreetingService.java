package com.example.demo;

import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class GreetingService {

    private final AtomicLong counter = new AtomicLong();

    // javax.annotation.PostConstruct -> jakarta.annotation.PostConstruct on upgrade
    @PostConstruct
    public void init() {
        System.out.println("GreetingService initialised");
    }

    public Greeting greet(String name) {
        return new Greeting(counter.incrementAndGet(), "Hello, " + name + "!");
    }
}
