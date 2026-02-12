import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// These will be replaced with your actual Supabase credentials
// Default to the provided project id if environment variable is not set
// `import.meta.env` is provided by Vite; TypeScript may not know custom keys
// so cast `import.meta` to `any` to access them safely here.
const supabaseUrl =
  (import.meta as any).murekefu_music_hub_SUPABASE_URL ||
  (import.meta as any).VITE_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  (import.meta as any).murekefu_music_hub_SUPABASE_ANON_KEY ||
  (import.meta as any).VITE_SUPABASE_ANON_KEY ||
  "";

const missing = !supabaseUrl || !supabaseAnonKey;

if (missing) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase environment variables are missing — client will be a safe stub. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Supabase.",
  );
}

function createMissingClientStub() {
  const message =
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Supabase features.";
  const err = new Error(message);

  // Return a proxy that converts any function access into a rejected Promise
  // so async callers get a clear failure instead of crashing on import.
  const fn = () => Promise.reject(err);

  const proxy = new Proxy(
    {},
    {
      get() {
        return fn;
      },
      apply() {
        return Promise.reject(err);
      },
    },
  );

  return proxy as any;
}

export const supabase = !missing
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingClientStub();



// Types for database tables
export interface User {
  id: string;
  firebase_uid: string | null;
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
}

export interface Role {
  id: number;
  name: 'buyer' | 'composer' | 'admin';
}

export interface UserRole {
  user_id: string;
  role_id: number;
  assigned_at: string;
}

export interface Buyer {
  id: string;
  user_id: string;
  billing_info: any | null;
  created_at: string;
}

export interface Composer {
  id: string;
  user_id: string;
  bio: string | null;
  payout_info: any | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Composition {
  id: string;
  composer_id: string;
  title: string;
  description: string | null;
  category_id: number | null;
  price: number;
  file_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  is_published: boolean;
  deleted: boolean;
}

export interface Purchase {
  id: string;
  buyer_id: string;
  composition_id: string;
  purchased_at: string;
  price_paid: number;
  payment_ref: string | null;
  is_active: boolean;
  metadata: any | null;
}

export interface CompositionStats {
  composition_id: string;
  views: number;
  purchases: number;
  last_updated: string;
}

export interface BuyerPreference {
  buyer_id: string;
  category_id: number;
  weight: number;
}

export interface Report {
  id: string;
  reported_by: string;
  composition_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'resolved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Newsletter {
  id: string;
  title: string;
  content: string;
  created_at: string;
  scheduled_at: string | null;
  sent: boolean;
  sent_count: number;
}

export interface SmsLog {
  id: string;
  user_id: string | null;
  phone: string;
  message: string;
  provider: string;
  status: string;
  provider_ref: string | null;
  sent_at: string;
  response: any | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  payload: any | null;
  created_at: string;
}

export interface FileUpload {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  bucket: 'compositions' | 'thumbnails' | 'avatars';
  storage_url: string;
  created_at: string;
  updated_at: string;
}

// Database setup SQL (for reference - run this in Supabase SQL editor)
export const DATABASE_SETUP_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Insert default roles
INSERT INTO roles (name) VALUES ('buyer'), ('composer'), ('admin')
ON CONFLICT (name) DO NOTHING;

-- User roles mapping
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, role_id)
);

-- Buyers table
CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  billing_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composers table
CREATE TABLE IF NOT EXISTS composers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  payout_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE compositions ENABLE ROW LEVEL SECURITY;

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compositions table
CREATE TABLE IF NOT EXISTS compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composer_id UUID REFERENCES composers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category_id INT REFERENCES categories(id),
  price NUMERIC(10,2) DEFAULT 0.00,
  file_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_published BOOLEAN DEFAULT TRUE,
  deleted BOOLEAN DEFAULT FALSE
);


-- Composition stats
CREATE TABLE IF NOT EXISTS composition_stats (
  composition_id UUID PRIMARY KEY REFERENCES compositions(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  purchases INT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  composition_id UUID REFERENCES compositions(id),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  price_paid NUMERIC(10,2) DEFAULT 0.00,
  payment_ref TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;


-- Buyer preferences
CREATE TABLE IF NOT EXISTS buyer_preferences (
  buyer_id UUID REFERENCES buyers(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id),
  weight INT DEFAULT 1,
  PRIMARY KEY(buyer_id, category_id)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES users(id),
  composition_id UUID REFERENCES compositions(id),
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Newsletters table
CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  sent BOOLEAN DEFAULT FALSE,
  sent_count INT DEFAULT 0
);

-- SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  phone TEXT,
  message TEXT,
  provider TEXT,
  status TEXT,
  provider_ref TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response JSONB
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- File uploads tracking table (for Supabase Storage)
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT NOT NULL,
  bucket TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Create indexes for file_uploads
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_bucket ON file_uploads(bucket);
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_path ON file_uploads(file_path);

-- Stored procedure: Purchase composition
CREATE OR REPLACE FUNCTION purchase_composition(
  p_buyer_id UUID,
  p_composition_id UUID,
  p_price_paid NUMERIC,
  p_payment_ref TEXT
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  -- Create purchase record
  INSERT INTO purchases (buyer_id, composition_id, price_paid, payment_ref)
  VALUES (p_buyer_id, p_composition_id, p_price_paid, p_payment_ref)
  RETURNING id INTO v_purchase_id;
  
  -- Update composition stats
  INSERT INTO composition_stats (composition_id, purchases)
  VALUES (p_composition_id, 1)
  ON CONFLICT (composition_id) DO UPDATE
  SET purchases = composition_stats.purchases + 1,
      last_updated = NOW();
  
  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure: Discard purchase
CREATE OR REPLACE FUNCTION discard_purchase(p_purchase_id UUID) RETURNS VOID AS $$
DECLARE
  v_composition_id UUID;
BEGIN
  -- Get composition ID
  SELECT composition_id INTO v_composition_id
  FROM purchases
  WHERE id = p_purchase_id AND is_active = TRUE;
  
  IF v_composition_id IS NOT NULL THEN
    -- Mark purchase as inactive
    UPDATE purchases SET is_active = FALSE WHERE id = p_purchase_id;
    
    -- Decrement purchase count
    UPDATE composition_stats
    SET purchases = GREATEST(purchases - 1, 0),
        last_updated = NOW()
    WHERE composition_id = v_composition_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure: Get FYP (For You Page) recommendations
CREATE OR REPLACE FUNCTION get_fyp_recommendations(
  p_buyer_id UUID,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  composition_id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  composer_name TEXT,
  category_name TEXT,
  score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH buyer_prefs AS (
    SELECT category_id, weight
    FROM buyer_preferences
    WHERE buyer_id = p_buyer_id
  ),
  scored_compositions AS (
    SELECT 
      c.id AS composition_id,
      c.title,
      c.description,
      c.price,
      u.display_name AS composer_name,
      cat.name AS category_name,
      COALESCE(bp.weight, 0) * 10 + 
      COALESCE(cs.purchases, 0) * 2 + 
      COALESCE(cs.views, 0) * 0.1 AS score
    FROM compositions c
    LEFT JOIN composers comp ON c.composer_id = comp.id
    LEFT JOIN users u ON comp.user_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN buyer_prefs bp ON c.category_id = bp.category_id
    LEFT JOIN composition_stats cs ON c.id = cs.composition_id
    WHERE c.is_published = TRUE 
      AND c.deleted = FALSE
      AND c.id NOT IN (
        SELECT composition_id 
        FROM purchases 
        WHERE buyer_id = p_buyer_id AND is_active = TRUE
      )
  )
  SELECT * FROM scored_compositions
  ORDER BY score DESC, created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

`;

export default supabase;
