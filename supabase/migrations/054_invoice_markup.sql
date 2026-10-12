-- Add markup_pct to invoice line items (default 15%)
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS markup_pct numeric DEFAULT 15;
