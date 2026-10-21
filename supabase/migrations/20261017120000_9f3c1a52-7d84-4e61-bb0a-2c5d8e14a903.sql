-- Départements visibles par un utilisateur (portée du module « employés »)
CREATE TABLE public.user_departments (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department)
);

ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own departments"
  ON public.user_departments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage departments"
  ON public.user_departments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
