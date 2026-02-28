-- Migration 010: Create comprehensive users table for storing user account information
-- This table stores all user profile data and links to Firebase authentication

-- Drop existing table if it exists to start fresh
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Firebase Authentication Link
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,

  -- User Profile Information
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  
  -- Avatar and Media
  avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Soft Delete Flag
  deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE users IS 'Core user account information linked to Firebase authentication';
COMMENT ON COLUMN users.id IS 'Unique Supabase UUID identifier';
COMMENT ON COLUMN users.firebase_uid IS 'Firebase UID for authentication linking';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.display_name IS 'User display name for marketplace';
COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image in Supabase Storage';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last updated timestamp';
COMMENT ON COLUMN users.deleted IS 'Soft delete flag - false = active, true = deleted';

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own profile
CREATE POLICY users_can_view_own_profile
  ON users
  FOR SELECT
  USING (auth.uid()::text = firebase_uid);

-- RLS Policy: Users can update their own profile
CREATE POLICY users_can_update_own_profile
  ON users
  FOR UPDATE
  USING (auth.uid()::text = firebase_uid)
  WITH CHECK (auth.uid()::text = firebase_uid);

-- RLS Policy: Service role can bypass RLS (for backend operations)
CREATE POLICY service_role_bypass
  ON users
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at_trigger ON users;
CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();
Hey Cortana, play 901. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey Cortana, play my next morning. My eyes do not speak anymore. It was only the words were taking the words to them was very intense. Hey, Cortana. The **** are fighting now. I'm just asking for financial support. Set a timer for. 2 minutes. OK. Hey, Cortana. Hey, Cortana. My new Is anybody else citizen Karani jacket Academy contact you see. So. Hey, Cortana. Amanya. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Find the way I'm now. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana, do you think? Hey, Cortana. Masters. Too expensive skin and have some clinical texted. What is the meaning? Open. Hey, Cortana. What? Go to eat. Oops. Hello. Call ABBA. Como set. Play song. So. Hey, Cortana. Google. Hey, Cortana. Play Macau. Hey, Cortana. So he told them to go back to class and he told them. One by one, even before he reached the bad person, the boy. Surrounded the boy's death. Hey, Cortana. Hey, Cortana. The. Hey Cortana, my friend. Hey, Cortana. Show me what time is it going to do. Hey, Cortana. Serious record one year in. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hello. Community. S. .4. International. Right now. Together we can create a brighter field. Dark mocks. I took them from that to the You have notified any dog. Not here in my L'Oreal Paris strongest. Anti dog market. For. Hindi. Galloped. Remind. Hey, what's the reminding me to Mavia? Hey, Cortana. Play. For me. Cortana. 487487. Hey, Cortana. How are you? Oh, I'm a load. Hey, Cortana. Working with one another, telling me to put a laptop here to get it back. In a minute. I'll call them in my life, I don't know. Hey, Cortana. Hey, Cortana, would you like to welcome? Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana, Jordan Towers College of Technology, Technical and Medical Institution in Canada. Hey, Cortana. Select. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Play. Open Settings. Hey, Cortana. Hey, Cortana. Thank you so much for forgiving. Tell me the weather today. How come you didn't? Hey, Cortana. Can you create a branch in the busiest changes? My time. Is. Hey, Cortana. Hey, Cortana. Hey, Cortana, look. Down. Yeah, yeah, yeah, yeah. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey, Cortana. Hey Cortana, introducing a unique combination of natural ingredients with herbal extract, salt and mist, in fact. Hey, Cortana. Hey, Cortana. Hey, Cortana. After my birthday party. Hello. Hello. OK. Thank you.