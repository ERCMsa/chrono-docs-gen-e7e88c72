-- Répare l'accès aux écrans Documents pour les comptes qui ne possèdent que
-- des permissions par type de document (le module « documents » contrôle les
-- routes /documents, /contracts et /generate/* : sans cette ligne, l'écran
-- reste inaccessible même avec doc_* autorisé).
-- Migration strictement additive : aucune ligne n'est supprimée.

INSERT INTO public.permissions (user_id, module, can_view, can_create, can_edit, can_delete)
SELECT DISTINCT p.user_id, 'documents', true, false, false, false
FROM public.permissions p
WHERE p.module IN ('doc_contract', 'doc_bon_sortie', 'doc_bon_entree', 'doc_avertissement')
  AND p.can_view = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissions x
    WHERE x.user_id = p.user_id AND x.module = 'documents'
  );
