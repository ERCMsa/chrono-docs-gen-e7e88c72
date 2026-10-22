-- Portée par DÉPARTEMENTS ATTRIBuÉS (table user_departments) au lieu du rôle.
--
-- Problème corrigé : les politiques RLS créées le 2026-05-25 comparaient
--   workers.department = current_user_role()::text
-- Or le rôle ne correspond pas toujours au nom du département :
--   rôle IT          -> département « IT DEVELOPMENT »
--   rôle GENIE_CIVIL -> département « GENIE CIVIL »
--   rôle ADMIN       -> département « ADMINISTRATION »
-- Un compte non ADMIN/RH (ex. rôle IT) recevait donc 0 employé de Supabase,
-- même avec tous les départements cochés dans la page Permissions : le filtre
-- côté navigateur n'avait aucune ligne à afficher.
--
-- Nouvelle règle (identique à celle de l'interface) :
--   1. ADMIN / RH : accès global ;
--   2. sinon, les départements attribués dans user_departments ;
--   3. sinon (aucune attribution, comptes hérités) : repli sur le département
--      du rôle, avec les alias IT / GENIE_CIVIL / ADMIN.
-- La comparaison est normalisée (casse, espaces, « _ » -> espace) des deux côtés.
--
-- Migration strictement additive : aucune donnée n'est supprimée, seules les
-- politiques de sécurité sont remplacées. Aucun changement côté application.

-- =====================================================================
-- Helpers
-- =====================================================================

CREATE OR REPLACE FUNCTION public.normalize_department(dept text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(replace(btrim(coalesce(dept, '')), '_', ' '), '\s+', ' ', 'g'))
$$;

-- Départements attribués au compte connecté (SECURITY DEFINER pour ne pas
-- dépendre de la politique de lecture de user_departments).
CREATE OR REPLACE FUNCTION public.current_user_departments()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT public.normalize_department(department)), '{}'::text[])
  FROM public.user_departments
  WHERE user_id = auth.uid()
$$;

-- Département de repli déduit du rôle (alias compris), normalisé.
CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_department(
    CASE p.role::text
      WHEN 'IT' THEN 'IT DEVELOPMENT'
      WHEN 'GENIE_CIVIL' THEN 'GENIE CIVIL'
      WHEN 'ADMIN' THEN 'ADMINISTRATION'
      ELSE p.role::text
    END
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- Un employé de ce département est-il visible par le compte connecté ?
CREATE OR REPLACE FUNCTION public.can_access_worker_department(dept text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_role() IN ('ADMIN', 'RH')
    OR public.normalize_department(dept) = ANY (public.current_user_departments())
    OR (
      public.current_user_departments() = '{}'::text[]
      AND public.normalize_department(dept) <> ''
      AND public.normalize_department(dept) = public.current_user_department()
    )
$$;

-- Même règle, depuis l'employé rattaché à un document.
CREATE OR REPLACE FUNCTION public.can_access_document_worker(p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_worker_department(
    (SELECT department FROM public.workers WHERE id = p_worker_id)
  )
$$;

-- =====================================================================
-- Employés : politiques remplacées (les anciennes reposaient sur le rôle)
-- =====================================================================

DROP POLICY IF EXISTS "Workers select scoped" ON public.workers;
DROP POLICY IF EXISTS "Workers insert scoped" ON public.workers;
DROP POLICY IF EXISTS "Workers update scoped" ON public.workers;
DROP POLICY IF EXISTS "Workers delete scoped" ON public.workers;

CREATE POLICY "Workers select scoped"
  ON public.workers FOR SELECT
  USING (public.can_access_worker_department(department));

-- À la création, un employé sans département reste autorisé : les écrans de
-- création rapide (Acomptes > Gestion employés, contrat avec nouvel employé)
-- ne demandent pas le département. Il restera invisible aux comptes restreints.
CREATE POLICY "Workers insert scoped"
  ON public.workers FOR INSERT
  WITH CHECK (
    public.normalize_department(department) = ''
    OR public.can_access_worker_department(department)
  );

CREATE POLICY "Workers update scoped"
  ON public.workers FOR UPDATE
  USING (public.can_access_worker_department(department))
  WITH CHECK (public.can_access_worker_department(department));

CREATE POLICY "Workers delete scoped"
  ON public.workers FOR DELETE
  USING (public.can_access_worker_department(department));

-- =====================================================================
-- Documents : politiques remplacées (même règle que les employés)
-- =====================================================================

DROP POLICY IF EXISTS "Documents select scoped" ON public.documents;
DROP POLICY IF EXISTS "Documents insert scoped" ON public.documents;
DROP POLICY IF EXISTS "Documents update scoped" ON public.documents;
DROP POLICY IF EXISTS "Documents delete scoped" ON public.documents;

CREATE POLICY "Documents select scoped"
  ON public.documents FOR SELECT
  USING (public.can_access_document_worker(worker_id));

CREATE POLICY "Documents insert scoped"
  ON public.documents FOR INSERT
  WITH CHECK (public.can_access_document_worker(worker_id));

CREATE POLICY "Documents update scoped"
  ON public.documents FOR UPDATE
  USING (public.can_access_document_worker(worker_id))
  WITH CHECK (public.can_access_document_worker(worker_id));

CREATE POLICY "Documents delete scoped"
  ON public.documents FOR DELETE
  USING (public.can_access_document_worker(worker_id));
