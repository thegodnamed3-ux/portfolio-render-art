-- The site never reads the `portfolio` bucket anonymously: public pages use the
-- long-lived signed URLs stored on each media row, and signed URLs do not depend
-- on this policy. Anonymous read access only exposed drafts and unassigned uploads,
-- so file reads are now limited to admins (who need it to sign new URLs).
DROP POLICY IF EXISTS "public reads portfolio files" ON storage.objects;
CREATE POLICY "admin reads portfolio files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio' AND public.has_role(auth.uid(), 'admin'));
