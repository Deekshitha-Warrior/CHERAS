-- ============================================================================
-- Migration: 20261022_0036_update_barcode_prefix_to_cc.sql
-- Description: Update barcode generation prefixes from UL to CC (Cheras Clothing)
--   - Products: CCP (Cheras Clothing Product)
--   - Variants: CCV (Cheras Clothing Variant)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_barcode_value(p_entity_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_entity_type = 'variant' THEN
    RETURN 'CCV' || LPAD(nextval('public.barcode_variant_seq')::TEXT, 8, '0');
  ELSE
    RETURN 'CCP' || LPAD(nextval('public.barcode_product_seq')::TEXT, 8, '0');
  END IF;
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.generate_barcode_value(TEXT) TO anon, authenticated, service_role;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
