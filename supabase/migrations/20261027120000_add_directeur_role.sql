-- Rôle « Directeur » : peut viser les documents (chef de service) des
-- départements CNC, MONTAGE et PRODUCTION.
--
-- La visibilité des employés/documents reste pilotée par la table
-- user_departments (attribution manuelle depuis la page Permissions) :
-- aucune politique RLS n'est modifiée ici.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'DIRECTEUR';
