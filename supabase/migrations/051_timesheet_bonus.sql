-- Migration 051: Weekly bonus column on timesheets
-- Run this in Supabase SQL Editor after migration 050

ALTER TABLE public.weekly_timesheets
  ADD COLUMN IF NOT EXISTS bonus numeric(10,2) NOT NULL DEFAULT 0;
