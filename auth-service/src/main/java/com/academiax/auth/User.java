package com.academiax.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    private UUID id;
    private String name;
    private String email;
    @Column(name = "password_hash")
    private String passwordHash;
    private String role;
    private String status;
    @Column(name = "created_at")
    private Instant createdAt;

    protected User() {}

    public User(UUID id, String name, String email, String passwordHash, String role, String status) {
        this.id = id;
        this.name = name;
        this.email = email.toLowerCase();
        this.passwordHash = passwordHash;
        this.role = role;
        this.status = status;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setStatus(String status) { this.status = status; }
}
