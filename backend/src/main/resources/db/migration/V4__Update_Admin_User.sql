-- Update the existing admin to a new admin user
-- Email: nlpadmin@nlpreview.com
-- Password is managed via environment variable at runtime by AdminInitializer

-- First, update the existing admin (if exists)
UPDATE users 
SET 
    email = 'nlpadmin@nlpreview.com',
    full_name = 'NLP Admin',
    role = 'ADMIN'
WHERE email = 'admin@nlpreview.com';

-- If no existing admin found, insert new one
INSERT INTO users (email, password_hash, full_name, role, email_verified, created_at, updated_at, failed_login_attempts, lock_time)
SELECT 'nlpadmin@nlpreview.com', '$2a$10$dummy_hash_for_migration', 'NLP Admin', 'ADMIN', true, NOW(), NOW(), 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'nlpadmin@nlpreview.com');

-- Delete the old admin if it exists
DELETE FROM users WHERE email = 'admin@nlpreview.com' AND email != 'nlpadmin@nlpreview.com';

-- Delete admin2 if it exists
DELETE FROM users WHERE email = 'admin2@nlpreview.com';
