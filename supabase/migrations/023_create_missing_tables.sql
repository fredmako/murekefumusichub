-- Missing tables for Murekefu Music Hub
-- Run this in Supabase SQL Editor to create tables that are referenced by the Worker but may not exist

-- Community rooms table
CREATE TABLE IF NOT EXISTS community_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Community messages table
CREATE TABLE IF NOT EXISTS community_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES community_rooms(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  message text,
  attachment_url text,
  attachment_name text,
  attachment_kind text DEFAULT 'text',
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Registration regulations table
CREATE TABLE IF NOT EXISTS registration_regulations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_fee numeric DEFAULT 0,
  composer_request_fee numeric DEFAULT 0,
  bank_name text DEFAULT '',
  bank_account_number text DEFAULT '',
  account_name text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- Payment submissions table
CREATE TABLE IF NOT EXISTS payment_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text DEFAULT 'enrollment',
  payment_ref text,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  submitted_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

-- Support threads table
CREATE TABLE IF NOT EXISTS support_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_user_id uuid NOT NULL,
  subject text NOT NULL,
  context text,
  status text DEFAULT 'open',
  assigned_admin_user_id uuid,
  assigned_at timestamptz,
  is_admin_unread boolean DEFAULT true,
  ticket_rejection_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Support messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_role text DEFAULT 'member',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Invites table
CREATE TABLE IF NOT EXISTS invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  invited_by uuid,
  requested_role text DEFAULT 'composer',
  used boolean DEFAULT false,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Role requests table
CREATE TABLE IF NOT EXISTS role_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  requested_role text NOT NULL,
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now()
);

-- Admin emails table
CREATE TABLE IF NOT EXISTS admin_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by uuid NOT NULL,
  composition_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Composition stats table
CREATE TABLE IF NOT EXISTS composition_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  composition_id uuid UNIQUE REFERENCES compositions(id) ON DELETE CASCADE,
  views int DEFAULT 0,
  purchases int DEFAULT 0
);

-- Insert default community room
INSERT INTO community_rooms (slug, name, description, is_public)
VALUES ('murekefu-community', 'Murekefu Community', 'A shared lounge for learners, composers, buyers, and the Murekefu team.', true)
ON CONFLICT (slug) DO NOTHING;
