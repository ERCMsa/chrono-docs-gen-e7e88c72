-- Nouveau type de document : Autorisation d'absence
-- =============================================================================

-- 1. Autoriser le nouveau type dans documents.document_type.
--    La contrainte d'origine autorisait aussi l'ancien libellé 'bon_rentree'
--    et omettait 'bon_entree' : on reconstruit la contrainte à partir des
--    types réellement utilisés par l'application.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%document_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Nettoyage des éventuelles lignes historiques 'bon_rentree'.
UPDATE public.documents
SET document_type = 'bon_entree'
WHERE document_type = 'bon_rentree';

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    'contract',
    'bon_sortie',
    'bon_entree',
    'avertissement',
    'autorisation_absence'
  ));

-- 2. Préfixe de référence AA- (ex. AA-001/2026).
CREATE OR REPLACE FUNCTION public.format_reference(_kind text, _year int, _seq int)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _kind
    WHEN 'contract'             THEN lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'bon_sortie'           THEN 'BS-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'bon_entree'           THEN 'BE-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'avertissement'        THEN 'AV-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'autorisation_absence' THEN 'AA-' || lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
    WHEN 'conge'                THEN lpad(_seq::text, greatest(2, length(_seq::text)), '0') || '/' || _year::text
    ELSE lpad(_seq::text, greatest(3, length(_seq::text)), '0') || '/' || _year::text
  END
$$;

-- 3. Relier les absences générées automatiquement à leur document source.
ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS document_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.absences'::regclass
      AND conname = 'absences_document_id_fkey'
  ) THEN
    ALTER TABLE public.absences
      ADD CONSTRAINT absences_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_absences_document ON public.absences(document_id);

-- 4. Reprendre les droits « bon de sortie » existants pour le nouveau type.
INSERT INTO public.permissions (user_id, module, can_view, can_create, can_edit, can_delete)
SELECT user_id, 'doc_autorisation_absence', can_view, can_create, can_edit, can_delete
FROM public.permissions
WHERE module = 'doc_bon_sortie'
ON CONFLICT (user_id, module) DO NOTHING;
