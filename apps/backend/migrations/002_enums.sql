-- 002_enums.sql
-- Define all enum types used across tables

-- User roles
CREATE TYPE user_role AS ENUM ('seeker', 'poster', 'admin', 'moderator');

-- Listing status lifecycle
CREATE TYPE listing_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'published',
  'archived'
);

-- Property types
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'land', 'commercial');

-- Media types
CREATE TYPE media_kind AS ENUM ('photo', 'video', 'doc');

-- Review results
CREATE TYPE review_result AS ENUM ('approved', 'rejected', 'needs_changes');

-- Viewing statuses
CREATE TYPE viewing_status AS ENUM ('proposed', 'confirmed', 'cancelled', 'completed');

-- Chat channels
CREATE TYPE chat_channel AS ENUM ('webchat', 'telegram', 'whatsapp');

-- Audit actor types
CREATE TYPE actor_type AS ENUM ('user', 'agent', 'system');
