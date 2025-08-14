DROP POLICY "Enable delete for users based on user_id" ON private.persons;
CREATE POLICY "Enable delete for users based on user_id" ON "private"."persons" as permissive FOR DELETE TO authenticated USING ((auth.uid() = persons.user_id));

DROP POLICY "Enable delete for users based on user_id" ON private.pointsofcontact;
CREATE POLICY "Enable delete for users based on user_id" ON "private"."pointsofcontact" as permissive FOR DELETE TO public USING (( auth.uid() = pointsofcontact.user_id));
