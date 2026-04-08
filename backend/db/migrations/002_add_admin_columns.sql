-- Migration 002: Add Admin Columns for Better Auth Admin Plugin
--
-- This migration adds columns required for user management features:
-- - Role-based access control (user/admin)
-- - User banning system
-- - Session impersonation for admins
--
-- @version 002
-- @date 2026-03-25
-- @author URLoft Team

-- ============================================
-- USERS TABLE: Admin and Ban Columns
-- ============================================

-- Add role column for user/admin distinction
-- Default 'user' for existing users
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Add banned flag to disable user accounts
ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;

-- Add reason for ban (admin-provided explanation)
ALTER TABLE users ADD COLUMN banReason TEXT;

-- Add optional expiration date for temporary bans
ALTER TABLE users ADD COLUMN banExpires DATETIME;

-- ============================================
-- INDEXES: Performance Optimization
-- ============================================

-- Index for filtering users by role (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index for filtering banned users (login checks)
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(banned);

-- ============================================
-- SESSIONS TABLE: Impersonation Support
-- ============================================

-- Add reference to admin user who created this session (for impersonation)
ALTER TABLE sessions ADD COLUMN impersonatedBy INTEGER;

-- Add index for finding all impersonated sessions by an admin
CREATE INDEX IF NOT EXISTS idx_sessions_impersonated_by ON sessions(impersonatedBy);

-- ============================================
-- DATA MIGRATION: Set Default Role
-- ============================================

-- Ensure all existing users have role='user' (in case DEFAULT didn't apply)
UPDATE users SET role = 'user' WHERE role IS NULL;
