-- ============================================================================
-- Migration: 20261019_0034_portal_logins_and_passwords.sql
-- Description: In-app changeable admin/staff portal credentials with brute force protection
-- ============================================================================

-- 1. Enable pgcrypto extension for bcrypt hash compatibility
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Ensure table public.portal_logins exists and has both login_id and password columns
CREATE TABLE IF NOT EXISTS public.portal_logins (
  role text PRIMARY KEY CHECK (role IN ('admin', 'staff')),
  login_id text NOT NULL UNIQUE,
  password_hash text,
  updated_at timestamptz DEFAULT now()
);

-- Safely add password column if it does not exist
ALTER TABLE public.portal_logins ADD COLUMN IF NOT EXISTS password text;

-- Allow password_hash to be nullable if it had a NOT NULL constraint previously
ALTER TABLE public.portal_logins ALTER COLUMN password_hash DROP NOT NULL;

-- Enable RLS with NO public policies (strictly accessible only via SECURITY DEFINER functions)
ALTER TABLE public.portal_logins ENABLE ROW LEVEL SECURITY;

-- 3. Brute-force protection table
CREATE TABLE IF NOT EXISTS public.portal_login_attempts (
  login_id text PRIMARY KEY,
  failed_count int DEFAULT 0,
  locked_until timestamptz DEFAULT NULL
);
ALTER TABLE public.portal_login_attempts ENABLE ROW LEVEL SECURITY;

-- 4. Seed / Update Admin & Staff rows with default placeholders if empty
INSERT INTO public.portal_logins (role, login_id, password_hash, password)
VALUES 
  ('admin', 'admin', extensions.crypt('CHANGE_ME_ADMIN_PASSWORD', extensions.gen_salt('bf')), 'CHANGE_ME_ADMIN_PASSWORD'),
  ('staff', 'staff', extensions.crypt('CHANGE_ME_STAFF_PASSWORD', extensions.gen_salt('bf')), 'CHANGE_ME_STAFF_PASSWORD')
ON CONFLICT (role) DO UPDATE SET 
  login_id = EXCLUDED.login_id,
  password = COALESCE(NULLIF(public.portal_logins.password, ''), EXCLUDED.password),
  password_hash = COALESCE(public.portal_logins.password_hash, EXCLUDED.password_hash),
  updated_at = now();

-- 5. RPC: portal_login (verifies credentials against password or bcrypt hash, with brute-force lockout)
CREATE OR REPLACE FUNCTION public.portal_login(p_id text, p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text;
  v_db_password text;
  v_db_hash text;
  v_locked_until timestamptz;
  v_failed int;
  v_authenticated boolean := false;
  v_clean_id text;
  v_clean_pass text;
BEGIN
  v_clean_id := LOWER(TRIM(COALESCE(p_id, '')));
  v_clean_pass := TRIM(COALESCE(p_password, ''));

  IF v_clean_id = '' OR v_clean_pass = '' THEN
    RETURN NULL;
  END IF;

  -- Fetch user record matching login_id (case-insensitive) OR fallback to role if p_id is 'admin' or 'staff'
  SELECT role, password, password_hash INTO v_role, v_db_password, v_db_hash
  FROM public.portal_logins
  WHERE LOWER(TRIM(login_id)) = v_clean_id
     OR LOWER(role) = v_clean_id
  ORDER BY (CASE WHEN LOWER(TRIM(login_id)) = v_clean_id THEN 0 ELSE 1 END)
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verify password against stored password or bcrypt hash
  IF (v_db_password IS NOT NULL AND (v_db_password = p_password OR TRIM(v_db_password) = v_clean_pass))
     OR (v_db_hash IS NOT NULL AND (v_db_hash = extensions.crypt(p_password, v_db_hash) OR v_db_hash = extensions.crypt(v_clean_pass, v_db_hash))) THEN
    v_authenticated := true;

    -- Auto-sync password column if it was empty
    IF v_db_password IS NULL OR v_db_password = '' THEN
      UPDATE public.portal_logins SET password = v_clean_pass WHERE role = v_role;
    END IF;
  END IF;

  -- If authenticated: clear any failed attempts and return authenticated role
  IF v_authenticated THEN
    DELETE FROM public.portal_login_attempts 
    WHERE LOWER(TRIM(login_id)) = v_clean_id OR LOWER(TRIM(login_id)) = LOWER(v_role);
    RETURN v_role;
  END IF;

  -- If NOT authenticated: check lockout status and record failure
  SELECT locked_until, failed_count INTO v_locked_until, v_failed 
  FROM public.portal_login_attempts 
  WHERE LOWER(TRIM(login_id)) = v_clean_id;

  INSERT INTO public.portal_login_attempts (login_id, failed_count, locked_until)
  VALUES (v_clean_id, 1, NULL)
  ON CONFLICT (login_id) DO UPDATE SET
    failed_count = public.portal_login_attempts.failed_count + 1,
    locked_until = CASE 
      WHEN public.portal_login_attempts.failed_count + 1 >= 5 THEN now() + interval '15 minutes'
      ELSE NULL
    END;

  RETURN NULL;
END;
$$;

-- 6. RPC: portal_get_credentials (Admin-only: validates admin password, then returns IDs and passwords)
CREATE OR REPLACE FUNCTION public.portal_get_credentials(p_admin_id text, p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text;
  v_result jsonb;
  v_clean_pass text;
BEGIN
  v_clean_pass := TRIM(COALESCE(p_admin_password, ''));

  -- Authenticate admin: match either via portal_login or direct password/hash check for admin role
  SELECT public.portal_login(p_admin_id, p_admin_password) INTO v_role;
  IF v_role <> 'admin' THEN
    IF EXISTS (
      SELECT 1 FROM public.portal_logins 
      WHERE role = 'admin' AND (
        (password IS NOT NULL AND (password = p_admin_password OR TRIM(password) = v_clean_pass)) OR
        (password_hash IS NOT NULL AND (password_hash = extensions.crypt(p_admin_password, password_hash) OR password_hash = extensions.crypt(v_clean_pass, password_hash)))
      )
    ) THEN
      v_role := 'admin';
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  -- Build JSON map with admin and staff credentials
  SELECT jsonb_object_agg(
    role, 
    jsonb_build_object(
      'login_id', login_id,
      'password', COALESCE(password, '')
    )
  )
  INTO v_result
  FROM public.portal_logins;

  RETURN v_result;
END;
$$;

-- 7. RPC: portal_update_credential (Admin-only: updates login_id and password for admin or staff)
CREATE OR REPLACE FUNCTION public.portal_update_credential(
  p_admin_id text,
  p_admin_password text,
  p_target_role text,
  p_new_login_id text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text;
  v_clean_pass text;
  v_new_id text;
  v_new_pass text;
BEGIN
  v_clean_pass := TRIM(COALESCE(p_admin_password, ''));
  v_new_id := TRIM(COALESCE(p_new_login_id, ''));
  v_new_pass := TRIM(COALESCE(p_new_password, ''));

  -- Authenticate admin
  SELECT public.portal_login(p_admin_id, p_admin_password) INTO v_role;
  IF v_role <> 'admin' THEN
    IF EXISTS (
      SELECT 1 FROM public.portal_logins 
      WHERE role = 'admin' AND (
        (password IS NOT NULL AND (password = p_admin_password OR TRIM(password) = v_clean_pass)) OR
        (password_hash IS NOT NULL AND (password_hash = extensions.crypt(p_admin_password, password_hash) OR password_hash = extensions.crypt(v_clean_pass, password_hash)))
      )
    ) THEN
      v_role := 'admin';
    ELSE
      RETURN false;
    END IF;
  END IF;

  -- Validation: minimum length
  IF length(v_new_id) < 3 OR length(v_new_pass) < 6 THEN
    RETURN false;
  END IF;

  -- Update record with both password and bcrypt hash
  UPDATE public.portal_logins
  SET login_id = v_new_id,
      password = v_new_pass,
      password_hash = extensions.crypt(v_new_pass, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE role = p_target_role;

  -- Clear any lockout or failed attempts for both old and new login_id
  DELETE FROM public.portal_login_attempts 
  WHERE LOWER(TRIM(login_id)) = LOWER(v_new_id) 
     OR LOWER(TRIM(login_id)) = LOWER(p_target_role);

  RETURN true;
END;
$$;

-- 8. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.portal_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_credentials(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_credential(text, text, text, text, text) TO anon, authenticated;

-- ============================================================================
-- MANUAL ROLLBACK BLOCK (In case of revert):
-- ============================================================================
/*
DROP FUNCTION IF EXISTS public.portal_update_credential(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.portal_get_credentials(text, text);
DROP FUNCTION IF EXISTS public.portal_login(text, text);
DROP TABLE IF EXISTS public.portal_login_attempts;
DROP TABLE IF EXISTS public.portal_logins;
*/
