-- Add Better Auth admin plugin fields to users table
-- Migration: 001_add_admin_fields.sql

-- Add role field (default: "user")
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Add banned field (default: 0 = not banned)
ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;

-- Add ban reason field
ALTER TABLE users ADD COLUMN ban_reason TEXT;

-- Add ban expiration field
ALTER TABLE users ADD COLUMN ban_expires DATETIME;
