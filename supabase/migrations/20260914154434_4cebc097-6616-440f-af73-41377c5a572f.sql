-- 1. Reference columns
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.conges ADD COLUMN IF NOT EXISTS reference text;

CREATE UNIQUE INDEX IF NOT EXISTS documents_reference_key ON public.documents (reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conges_reference_key ON public.conges (reference) WHERE reference IS NOT NULL;

-- 2. Counter table (atomic sequence per kind + year)
CREATE TABLE IF NOT EXISTS public.reference_counters (
  kind text NOT NULL,
  year int NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, year)
);

GRANT SELECT ON public.reference_counters TO authenticated;
GRANT ALL ON public.reference_counters TO service_role;
ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read reference counters"
  ON public.reference_counters FOR SELECT TO authenticated USING (true);

-- 3. Reference format per kind
CREATE OR REPLACE FUNCTION public.format_reference(_kind text, _year int, _seq int)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _kind
    WHEN 'contract'      THEN lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'bon_sortie'    THEN 'BS-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'bon_entree'    THEN 'BE-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'avertissement' THEN 'AV-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'conge'         THEN lpad(_seq::text, greatest(2, length(_seq::text)), '0') || '/' || _year::text
    ELSE lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
  END
$$;

-- 4. Atomic next reference
CREATE OR REPLACE FUNCTION public.next_reference(_kind text, _year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  s int;
BEGIN
  INSERT INTO public.reference_counters (kind, year, last_seq)
  VALUES (_kind, y, 1)
  ON CONFLICT (kind, year)
  DO UPDATE SET last_seq = public.reference_counters.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO s;

  RETURN public.format_reference(_kind, y, s);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_reference(text, int) TO authenticated, anon, service_role;

-- 5. Triggers filling the reference on insert
CREATE OR REPLACE FUNCTION public.set_document_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;
BEGIN
  IF NEW.reference IS NULL OR btrim(NEW.reference) = '' THEN
    NEW.reference := public.next_reference(NEW.document_type, y);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_set_reference ON public.documents;
CREATE TRIGGER documents_set_reference
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_document_reference();

CREATE OR REPLACE FUNCTION public.set_conge_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := EXTRACT(YEAR FROM COALESCE(NEW.start_date, CURRENT_DATE))::int;
BEGIN
  IF NEW.reference IS NULL OR btrim(NEW.reference) = '' THEN
    NEW.reference := public.next_reference('conge', y);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conges_set_reference ON public.conges;
CREATE TRIGGER conges_set_reference
  BEFORE INSERT ON public.conges
  FOR EACH ROW EXECUTE FUNCTION public.set_conge_reference();

-- 6. Backfill references for existing rows (sequential per type and year)
WITH ranked AS (
  SELECT id, document_type, EXTRACT(YEAR FROM created_at)::int AS y,
         row_number() OVER (PARTITION BY document_type, EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS rn
  FROM public.documents
  WHERE reference IS NULL
)
UPDATE public.documents d
SET reference = public.format_reference(r.document_type, r.y, r.rn::int)
FROM ranked r WHERE r.id = d.id;

WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM start_date)::int AS y,
         row_number() OVER (PARTITION BY EXTRACT(YEAR FROM start_date) ORDER BY start_date, id) AS rn
  FROM public.conges
  WHERE reference IS NULL
)
UPDATE public.conges c
SET reference = public.format_reference('conge', r.y, r.rn::int)
FROM ranked r WHERE r.id = c.id;

-- 7. Seed counters so new references continue after existing ones
INSERT INTO public.reference_counters (kind, year, last_seq)
SELECT document_type, EXTRACT(YEAR FROM created_at)::int, COUNT(*)::int
FROM public.documents
GROUP BY 1, 2
ON CONFLICT (kind, year) DO UPDATE SET last_seq = GREATEST(public.reference_counters.last_seq, EXCLUDED.last_seq);

INSERT INTO public.reference_counters (kind, year, last_seq)
SELECT 'conge', EXTRACT(YEAR FROM start_date)::int, COUNT(*)::int
FROM public.conges
GROUP BY 2
ON CONFLICT (kind, year) DO UPDATE SET last_seq = GREATEST(public.reference_counters.last_seq, EXCLUDED.last_seq);