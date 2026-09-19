-- D1 Schema for Murekefu Music Hub
-- Full replacement for Supabase Postgres

-- Users (replaces Auth + public.users)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  email_verified INTEGER DEFAULT 0,
  theme_settings TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Roles & permissions
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE user_roles (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Compositions
CREATE TABLE compositions (
  id TEXT PRIMARY KEY,
  composer_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES categories(id),
  price INTEGER DEFAULT 0,
  price_currency TEXT DEFAULT 'USD',
  pdf_r2_key TEXT,
  midi_r2_key TEXT,
  thumbnail_r2_key TEXT,
  is_published INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 0,
  verified_at TEXT,
  verified_by TEXT,
  deleted INTEGER DEFAULT 0,
  duration TEXT,
  voice_parts TEXT,
  accompaniment TEXT,
  difficulty TEXT,
  language TEXT,
  midi_url TEXT,
  original_link TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- Purchases
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  buyer_id TEXT REFERENCES users(id),
  composition_id TEXT REFERENCES compositions(id),
  price_paid INTEGER DEFAULT 0,
  payment_ref TEXT,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Payment submissions
CREATE TABLE payment_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  type TEXT DEFAULT 'enrollment',
  payment_ref TEXT,
  amount INTEGER DEFAULT 0,
  mpesa_code TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TEXT DEFAULT (datetime('now')),
  approved_at TEXT,
  rejected_at TEXT
);

-- Enrollments
CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  full_name TEXT,
  email TEXT,
  music_class TEXT,
  skill_level TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  admitted_at TEXT
);

-- Invites
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  invited_by TEXT REFERENCES users(id),
  requested_role TEXT DEFAULT 'composer',
  used INTEGER DEFAULT 0,
  used_by TEXT,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Role requests
CREATE TABLE role_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  requested_role TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TEXT DEFAULT (datetime('now'))
);

-- Support threads
CREATE TABLE support_threads (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT REFERENCES users(id),
  subject TEXT NOT NULL,
  context TEXT,
  status TEXT DEFAULT 'open',
  assigned_admin_user_id TEXT,
  assigned_at TEXT,
  is_admin_unread INTEGER DEFAULT 1,
  ticket_rejection_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Support messages
CREATE TABLE support_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users(id),
  sender_role TEXT DEFAULT 'member',
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Community rooms
CREATE TABLE community_rooms (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Community messages
CREATE TABLE community_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES community_rooms(id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users(id),
  message TEXT,
  attachment_r2_key TEXT,
  attachment_name TEXT,
  attachment_kind TEXT DEFAULT 'text',
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Registration regulations
CREATE TABLE registration_regulations (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  enrollment_fee INTEGER DEFAULT 0,
  composer_request_fee INTEGER DEFAULT 0,
  bank_name TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  account_name TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Reports
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reported_by TEXT REFERENCES users(id),
  composition_id TEXT REFERENCES compositions(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Admin emails
CREATE TABLE admin_emails (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sessions (for token revocation)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_compositions_composer ON compositions(composer_id);
CREATE INDEX idx_compositions_published ON compositions(is_published);
CREATE INDEX idx_purchases_buyer ON purchases(buyer_id);
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_support_threads_requester ON support_threads(requester_user_id);
CREATE INDEX idx_community_messages_room ON community_messages(room_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_payment_submissions_user ON payment_submissions(user_id);

-- Seed default roles
INSERT INTO roles (id, name, description) VALUES
  ('role_buyer', 'buyer', 'Can browse and purchase compositions'),
  ('role_composer', 'composer', 'Can upload and sell compositions'),
  ('role_learner', 'learner', 'Can enroll in music classes'),
  ('role_admin', 'admin', 'Full administrative access')
ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description;

-- Seed default community room
INSERT INTO community_rooms (id, slug, name, description, is_public) VALUES
  ('room_main', 'murekefu-community', 'Murekefu Community', 'A shared lounge for learners, composers, buyers, and the Murekefu team.', 1);

-- Seed default regulations
INSERT INTO registration_regulations (id) VALUES ('singleton');
