REVOKE EXECUTE ON FUNCTION public.next_reference(text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_reference(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_reference(text, int) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.format_reference(text, int, int) FROM anon;