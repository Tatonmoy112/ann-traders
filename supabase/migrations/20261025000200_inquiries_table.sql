-- Migration: 20261025000200_inquiries_table.sql
-- Description: Create public.inquiries table for B2B RFQ quotation requests

CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_sku TEXT,
  target_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  delivery_term TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'quoted', 'closed')),
  admin_notes TEXT,
  quoted_amount NUMERIC,
  quoted_currency TEXT DEFAULT 'BDT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_reference_number ON public.inquiries(reference_number);
CREATE INDEX IF NOT EXISTS idx_inquiries_company ON public.inquiries(company_name);

-- RLS
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS inquiries_service_all ON public.inquiries;
DROP POLICY IF EXISTS inquiries_admin_select ON public.inquiries;
DROP POLICY IF EXISTS inquiries_admin_update ON public.inquiries;

-- Service role full access
CREATE POLICY inquiries_service_all ON public.inquiries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can view all inquiries
CREATE POLICY inquiries_admin_select ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid() AND is_active = true));

-- Authenticated admins can update inquiry status and notes
CREATE POLICY inquiries_admin_update ON public.inquiries
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid() AND is_active = true));

