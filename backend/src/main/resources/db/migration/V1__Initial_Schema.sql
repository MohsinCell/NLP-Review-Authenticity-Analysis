-- V1__Initial_Schema.sql
-- NLP Review Authenticity Analyzer - Database Schema

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    account_locked BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lock_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    issued_from_ip VARCHAR(45),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Review analyses table (individual review analysis history)
CREATE TABLE review_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_review_text TEXT NOT NULL,
    sentiment VARCHAR(20) NOT NULL,
    predicted_rating INT NOT NULL,
    ai_generated_probability DOUBLE PRECISION NOT NULL,
    authenticity_score INT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    detected_language VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_analyses_user_id ON review_analyses(user_id);
CREATE INDEX idx_review_analyses_created_at ON review_analyses(created_at);

-- Link analyses table (product link analysis history)
CREATE TABLE link_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_product_url TEXT NOT NULL,
    domain VARCHAR(100) NOT NULL,
    total_reviews_analyzed INT NOT NULL,
    positive_percentage DOUBLE PRECISION NOT NULL,
    negative_percentage DOUBLE PRECISION NOT NULL,
    neutral_percentage DOUBLE PRECISION NOT NULL,
    average_predicted_rating DOUBLE PRECISION NOT NULL,
    ai_generated_percentage DOUBLE PRECISION NOT NULL,
    languages_detected VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_link_analyses_user_id ON link_analyses(user_id);
CREATE INDEX idx_link_analyses_created_at ON link_analyses(created_at);

-- Site visits table (visitor metrics)
CREATE TABLE site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    authenticated BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    user_id UUID,
    response_status INT NOT NULL,
    response_time_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_site_visits_created_at ON site_visits(created_at);
CREATE INDEX idx_site_visits_endpoint ON site_visits(endpoint);

-- Analysis metrics table (aggregated analytics)
CREATE TABLE analysis_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_type VARCHAR(20) NOT NULL,
    authenticated BOOLEAN NOT NULL DEFAULT FALSE,
    user_id UUID,
    detected_language VARCHAR(50),
    domain VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_metrics_created_at ON analysis_metrics(created_at);
CREATE INDEX idx_analysis_metrics_type ON analysis_metrics(analysis_type);

-- Create default admin user (password set via environment variable at runtime)
-- This migration admin is superseded by AdminInitializer on startup
INSERT INTO users (email, full_name, password_hash, role)
VALUES ('admin@nlpreview.com', 'System Admin',
        '$2a$12$placeholder_replaced_by_app_on_startup_000000000000000000',
        'ADMIN')
ON CONFLICT (email) DO NOTHING;
