-- SQL Script to Update Admin User
-- Run this in pgAdmin or via psql

-- Update existing admin to new admin
UPDATE users 
SET 
    email = 'nlpadmin@nlpreview.com',
    full_name = 'NLP Admin',
    role = 'ADMIN'
WHERE email = 'admin@nlpreview.com';

-- Delete any duplicate admins
DELETE FROM users WHERE email IN ('admin@nlpreview.com', 'admin2@nlpreview.com') AND email != 'nlpadmin@nlpreview.com';

-- Verify the update
SELECT id, email, full_name, role FROM users WHERE email = 'nlpadmin@nlpreview.com';
