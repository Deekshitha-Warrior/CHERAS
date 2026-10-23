-- ==============================================================================
-- Migration: 20261023_0037_inventory_cost_price_and_low_stock_sync.sql
-- Description:
--   1. Ensures cost_price column exists on products and product_variants
--   2. Ensures purchase_price is nullable on products and product_variants
--   3. Ensures low_stock_alert column exists with default 5
--   4. Backfills existing cost_price <-> purchase_price bidirectionally
--   5. Creates robust bidirectional sync triggers so any update to cost_price or
--      purchase_price automatically synchronizes the counterpart column
--   6. Grants table permissions
-- ==============================================================================

-- 1. Ensure cost_price column exists on products and product_variants
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2);
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2);

-- 2. Drop NOT NULL on purchase_price so cost is optional (NULL allowed)
ALTER TABLE public.products ALTER COLUMN purchase_price DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN purchase_price SET DEFAULT NULL;

ALTER TABLE public.product_variants ALTER COLUMN purchase_price DROP NOT NULL;
ALTER TABLE public.product_variants ALTER COLUMN purchase_price SET DEFAULT NULL;

-- 3. Ensure low_stock_alert exists on products with default 5
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_alert NUMERIC(12,3) NOT NULL DEFAULT 5;

-- 4. Backfill existing records bidirectionally
UPDATE public.products
SET cost_price = purchase_price
WHERE cost_price IS NULL AND purchase_price IS NOT NULL;

UPDATE public.products
SET purchase_price = cost_price
WHERE purchase_price IS NULL AND cost_price IS NOT NULL;

UPDATE public.product_variants
SET cost_price = purchase_price
WHERE cost_price IS NULL AND purchase_price IS NOT NULL;

UPDATE public.product_variants
SET purchase_price = cost_price
WHERE purchase_price IS NULL AND cost_price IS NOT NULL;

-- 5. Bidirectional trigger for products (keeps purchase_price and cost_price in sync)
CREATE OR REPLACE FUNCTION public.sync_product_cost_price()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cost_price IS NOT NULL AND NEW.purchase_price IS NULL THEN
      NEW.purchase_price := NEW.cost_price;
    ELSIF NEW.purchase_price IS NOT NULL AND NEW.cost_price IS NULL THEN
      NEW.cost_price := NEW.purchase_price;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cost_price IS DISTINCT FROM OLD.cost_price AND NEW.purchase_price IS NOT DISTINCT FROM OLD.purchase_price THEN
      NEW.purchase_price := NEW.cost_price;
    ELSIF NEW.purchase_price IS DISTINCT FROM OLD.purchase_price AND NEW.cost_price IS NOT DISTINCT FROM OLD.cost_price THEN
      NEW.cost_price := NEW.purchase_price;
    ELSIF NEW.cost_price IS NOT NULL AND NEW.purchase_price IS NULL THEN
      NEW.purchase_price := NEW.cost_price;
    ELSIF NEW.purchase_price IS NOT NULL AND NEW.cost_price IS NULL THEN
      NEW.cost_price := NEW.purchase_price;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_cost_price ON public.products;
CREATE TRIGGER trg_sync_product_cost_price
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_cost_price();

-- 6. Bidirectional trigger for product_variants (keeps purchase_price and cost_price in sync)
CREATE OR REPLACE FUNCTION public.sync_variant_cost_price()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cost_price IS NOT NULL AND NEW.purchase_price IS NULL THEN
      NEW.purchase_price := NEW.cost_price;
    ELSIF NEW.purchase_price IS NOT NULL AND NEW.cost_price IS NULL THEN
      NEW.cost_price := NEW.purchase_price;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cost_price IS DISTINCT FROM OLD.cost_price AND NEW.purchase_price IS NOT DISTINCT FROM OLD.purchase_price THEN
      NEW.purchase_price := NEW.cost_price;
    ELSIF NEW.purchase_price IS DISTINCT FROM OLD.purchase_price AND NEW.cost_price IS NOT DISTINCT FROM OLD.cost_price THEN
      NEW.cost_price := NEW.purchase_price;
    ELSIF NEW.cost_price IS NOT NULL AND NEW.purchase_price IS NULL THEN
      NEW.purchase_price := NEW.cost_price;
    ELSIF NEW.purchase_price IS NOT NULL AND NEW.cost_price IS NULL THEN
      NEW.cost_price := NEW.purchase_price;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_variant_cost_price ON public.product_variants;
CREATE TRIGGER trg_sync_variant_cost_price
BEFORE INSERT OR UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.sync_variant_cost_price();

-- 7. Grant access permissions
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.product_variants TO authenticated, anon, service_role;
