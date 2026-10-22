-- Migration: 20261022_0035_rebrand_to_cheras_clothing.sql
-- Rebrand store details to Cheras Clothing (Coimbatore)

BEGIN;

-- 1. Upsert or update store_settings (id = 1)
INSERT INTO public.store_settings (
  id,
  name,
  owner_name,
  phone,
  email,
  address,
  city,
  business_hours,
  tagline,
  instagram_url,
  catalog_headline,
  gstin,
  theme_color,
  logo_url,
  gst_enabled,
  updated_at
)
VALUES (
  1,
  'Cheras Clothing',
  '',
  '9715083947',
  'cherasclothing777@gmail.com',
  '74, cheras clothing,avinashi road, opposite to gov medical college,Coimbatore 641014.',
  'Coimbatore, Tamil Nadu',
  'Open Daily 9:30 AM - 9:30 PM',
  'Exclusive Mens, Womens & Kids Wear',
  'https://instagram.com/cherasclothing_official?obrf=eG52MzN2d3loemli',
  'Exclusive Mens Wear, Womens Wear & Kids Wear',
  '33APAPR3524F1Z9',
  '#7B1E2B',
  '/cheras-icon.png',
  TRUE,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Cheras Clothing',
  phone = '9715083947',
  email = 'cherasclothing777@gmail.com',
  address = '74, cheras clothing,avinashi road, opposite to gov medical college,Coimbatore 641014.',
  city = 'Coimbatore, Tamil Nadu',
  instagram_url = 'https://instagram.com/cherasclothing_official?obrf=eG52MzN2d3loemli',
  logo_url = '/cheras-icon.png',
  updated_at = NOW();

COMMIT;
