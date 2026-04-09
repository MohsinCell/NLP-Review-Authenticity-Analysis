-- V3__Add_Another_Admin_User.sql
-- Adds another admin user for testing/admin purposes
-- Password is set via environment variable at runtime by AdminInitializer

INSERT INTO users (email, full_name, password_hash, role)
VALUES ('admin2@nlpreview.com', 'Secondary Admin',
        '$2a$12$placeholder_replaced_by_app_on_startup_000000000000000000',
        'ADMIN')
ON CONFLICT (email) DO NOTHING;
