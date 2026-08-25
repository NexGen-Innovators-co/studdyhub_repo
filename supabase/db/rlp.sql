"CREATE POLICY ""Users can insert own achievements"" ON public.achievements AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY achievements_select_own ON public.achievements AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY admin_activity_logs_select_admin ON public.admin_activity_logs AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());"
"CREATE POLICY super_admin_delete_admin_activity_logs ON public.admin_activity_logs AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_admin_activity_logs ON public.admin_activity_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_admin_activity_logs ON public.admin_activity_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_admin_activity_logs ON public.admin_activity_logs AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can manage system settings"" ON public.admin_system_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin(auth.uid(), 'admin'::admin_role));"
"CREATE POLICY ""Public settings are readable by all"" ON public.admin_system_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_public = true));"
"CREATE POLICY super_admin_delete_admin_system_settings ON public.admin_system_settings AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_admin_system_settings ON public.admin_system_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_admin_system_settings ON public.admin_system_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_admin_system_settings ON public.admin_system_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Super admins can manage admin users"" ON public.admin_users AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin(auth.uid(), 'super_admin'::admin_role));"
"CREATE POLICY admin_users_select_admin ON public.admin_users AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR is_admin()));"
"CREATE POLICY ""Admins can manage all podcasts"" ON public.ai_podcasts AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid()))));"
"CREATE POLICY ""Anyone can view public podcasts"" ON public.ai_podcasts AS PERMISSIVE FOR SELECT TO anon
  USING ((is_public = true));"
"CREATE POLICY ai_podcasts_delete_own ON public.ai_podcasts AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ai_podcasts_insert_own ON public.ai_podcasts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ai_podcasts_select_own_or_public ON public.ai_podcasts AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (is_public = true)));"
"CREATE POLICY ai_podcasts_update_own ON public.ai_podcasts AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_ai_podcasts ON public.ai_podcasts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_ai_podcasts ON public.ai_podcasts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ai_user_memory_delete_own ON public.ai_user_memory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ai_user_memory_insert_own ON public.ai_user_memory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ai_user_memory_select_own ON public.ai_user_memory AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ai_user_memory_update_own ON public.ai_user_memory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ""Admins can read all ratings"" ON public.app_ratings AS PERMISSIVE FOR SELECT TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Anyone can read ratings"" ON public.app_ratings AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Users can insert own rating"" ON public.app_ratings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own rating"" ON public.app_ratings AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Allow authenticated insert of default stats row"" ON public.app_stats AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((id = '00000000-0000-0000-0000-000000000001'::uuid));"
"CREATE POLICY ""Allow authenticated update of stats row"" ON public.app_stats AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((id = '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK ((id = '00000000-0000-0000-0000-000000000001'::uuid));"
"CREATE POLICY ""Allow public read access to app_stats"" ON public.app_stats AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY super_admin_delete_app_stats ON public.app_stats AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_app_stats ON public.app_stats AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_app_stats ON public.app_stats AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_app_stats ON public.app_stats AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can delete any testimonial"" ON public.app_testimonials AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Admins can read all testimonials"" ON public.app_testimonials AS PERMISSIVE FOR SELECT TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Admins can update any testimonial"" ON public.app_testimonials AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Anyone can read approved testimonials"" ON public.app_testimonials AS PERMISSIVE FOR SELECT TO public
  USING (((is_approved = true) OR (auth.uid() = user_id)));"
"CREATE POLICY ""Users can delete own testimonial"" ON public.app_testimonials AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can insert own testimonial"" ON public.app_testimonials AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own testimonial"" ON public.app_testimonials AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Allow authenticated users to insert their own audio processing "" ON public.audio_processing_results AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Allow authenticated users to read their own audio processing re"" ON public.audio_processing_results AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Allow authenticated users to update their own audio processing "" ON public.audio_processing_results AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete their own audio processing results"" ON public.audio_processing_results AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_audio_processing_results ON public.audio_processing_results AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_audio_processing_results ON public.audio_processing_results AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_audio_processing_results ON public.audio_processing_results AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_audio_processing_results ON public.audio_processing_results AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Insert/Update for podcast hosts on audio_segments"" ON public.audio_segments AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = audio_segments.podcast_id) AND (p.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = audio_segments.podcast_id) AND (p.user_id = auth.uid())))));"
"CREATE POLICY ""Read access for audio segments"" ON public.audio_segments AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = audio_segments.podcast_id) AND ((p.is_public = true) OR ((auth.uid() IS NOT NULL) AND (p.user_id = auth.uid())))))) OR ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM podcast_members pm
  WHERE ((pm.podcast_id = audio_segments.podcast_id) AND (pm.user_id = auth.uid())))))));"
"CREATE POLICY ""Authenticated users can view badges"" ON public.badges AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);"
"CREATE POLICY ""Users can delete own integrations"" ON public.calendar_integrations AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can insert own integrations"" ON public.calendar_integrations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own integrations"" ON public.calendar_integrations AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own integrations"" ON public.calendar_integrations AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Enable update for users"" ON public.chat_messages AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY chat_messages_delete_own ON public.chat_messages AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY chat_messages_insert_own ON public.chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY chat_messages_select_own ON public.chat_messages AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_chat_messages ON public.chat_messages AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_chat_messages ON public.chat_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_chat_messages ON public.chat_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_chat_messages ON public.chat_messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY chat_sessions_delete_own ON public.chat_sessions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY chat_sessions_insert_own ON public.chat_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY chat_sessions_select_own ON public.chat_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY chat_sessions_update_own ON public.chat_sessions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_chat_sessions ON public.chat_sessions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_chat_sessions ON public.chat_sessions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_chat_sessions ON public.chat_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_chat_sessions ON public.chat_sessions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Allow read for owners and shared recordings via chat"" ON public.class_recordings AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((social_chat_message_resources r
     JOIN social_chat_messages m ON ((m.id = r.message_id)))
     JOIN social_chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((r.resource_id = class_recordings.id) AND ((r.resource_type)::text = 'class_recording'::text) AND ((((s.chat_type)::text = 'p2p'::text) AND ((s.user_id1 = auth.uid()) OR (s.user_id2 = auth.uid()))) OR (((s.chat_type)::text = 'group'::text) AND (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))))));"
"CREATE POLICY class_recordings_delete_own ON public.class_recordings AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY class_recordings_insert_own ON public.class_recordings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY class_recordings_select_own ON public.class_recordings AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY class_recordings_update_own ON public.class_recordings AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_class_recordings ON public.class_recordings AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_class_recordings ON public.class_recordings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_class_recordings ON public.class_recordings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_class_recordings ON public.class_recordings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can view all moderation logs"" ON public.content_moderation_log AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND ((admin_users.role = 'super_admin'::admin_role) OR (admin_users.role = 'admin'::admin_role) OR (admin_users.role = 'moderator'::admin_role))))));"
"CREATE POLICY ""Block client inserts on moderation logs"" ON public.content_moderation_log AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (false);"
"CREATE POLICY ""Users can view their own moderation logs"" ON public.content_moderation_log AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Admins can manage moderation queue"" ON public.content_moderation_queue AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin(auth.uid()));"
"CREATE POLICY super_admin_delete_content_moderation_queue ON public.content_moderation_queue AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_content_moderation_queue ON public.content_moderation_queue AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_content_moderation_queue ON public.content_moderation_queue AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_content_moderation_queue ON public.content_moderation_queue AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can manage countries"" ON public.countries AS PERMISSIVE FOR ALL TO public
  USING (is_admin());"
"CREATE POLICY ""Anyone can read active countries"" ON public.countries AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));"
"CREATE POLICY ""Users can delete own enrollment"" ON public.course_enrollments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can enroll themselves"" ON public.course_enrollments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own enrollment"" ON public.course_enrollments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY enrollments_select_scoped ON public.course_enrollments AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_enrollments.course_id) AND (c.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_enrollments.course_id) AND (c.institution_id IS NOT NULL) AND is_institution_member(auth.uid(), c.institution_id, 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY ""Admins can delete course_materials"" ON public.course_materials AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());"
"CREATE POLICY ""Admins can insert course_materials"" ON public.course_materials AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());"
"CREATE POLICY ""Admins can update course_materials"" ON public.course_materials AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin());"
"CREATE POLICY ""Everyone can view course_materials"" ON public.course_materials AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Public read access"" ON public.course_materials AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Users can insert own progress"" ON public.course_progress AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM course_enrollments
  WHERE ((course_enrollments.id = course_progress.enrollment_id) AND (course_enrollments.user_id = auth.uid())))));"
"CREATE POLICY ""Users can update own progress"" ON public.course_progress AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM course_enrollments
  WHERE ((course_enrollments.id = course_progress.enrollment_id) AND (course_enrollments.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM course_enrollments
  WHERE ((course_enrollments.id = course_progress.enrollment_id) AND (course_enrollments.user_id = auth.uid())))));"
"CREATE POLICY ""Users can view own progress"" ON public.course_progress AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM course_enrollments
  WHERE ((course_enrollments.id = course_progress.enrollment_id) AND (course_enrollments.user_id = auth.uid())))));"
"CREATE POLICY ""Anyone can view course resources"" ON public.course_resources AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);"
"CREATE POLICY educators_delete_course_resources ON public.course_resources AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.institution_id IS NOT NULL) AND is_institution_member(auth.uid(), c.institution_id, 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY educators_insert_course_resources ON public.course_resources AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.institution_id IS NOT NULL) AND is_institution_member(auth.uid(), c.institution_id, 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY educators_update_course_resources ON public.course_resources AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.institution_id IS NOT NULL) AND is_institution_member(auth.uid(), c.institution_id, 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_resources.course_id) AND (c.institution_id IS NOT NULL) AND is_institution_member(auth.uid(), c.institution_id, 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY ""Admins can delete courses"" ON public.courses AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());"
"CREATE POLICY ""Admins can insert courses"" ON public.courses AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());"
"CREATE POLICY ""Admins can update courses"" ON public.courses AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin());"
"CREATE POLICY ""Everyone can view courses"" ON public.courses AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Public read access"" ON public.courses AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY courses_delete_own ON public.courses AS PERMISSIVE FOR DELETE TO authenticated
  USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY courses_insert_educator ON public.courses AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_educator(auth.uid()) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY courses_select_visible ON public.courses AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((visibility = 'public'::text) AND (is_published = true)) OR ((visibility = 'institution'::text) AND (institution_id IN ( SELECT user_institution_ids(auth.uid()) AS user_institution_ids))) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY courses_update_own ON public.courses AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))))
  WITH CHECK (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid())))));"
"CREATE POLICY ""Admins can manage curricula"" ON public.curricula AS PERMISSIVE FOR ALL TO public
  USING (is_admin());"
"CREATE POLICY ""Anyone can read active curricula"" ON public.curricula AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));"
"CREATE POLICY admins_view_all_notification_logs ON public.daily_notification_log AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY system_insert_notification_logs ON public.daily_notification_log AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);"
"CREATE POLICY users_view_own_notification_logs ON public.daily_notification_log AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ""Users can add items to their folders"" ON public.document_folder_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM document_folders
  WHERE ((document_folders.id = document_folder_items.folder_id) AND (document_folders.user_id = auth.uid())))));"
"CREATE POLICY ""Users can delete items from their folders"" ON public.document_folder_items AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM document_folders
  WHERE ((document_folders.id = document_folder_items.folder_id) AND (document_folders.user_id = auth.uid())))));"
"CREATE POLICY ""Users can update items in their folders"" ON public.document_folder_items AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM document_folders
  WHERE ((document_folders.id = document_folder_items.folder_id) AND (document_folders.user_id = auth.uid())))));"
"CREATE POLICY ""Users can view items in their folders"" ON public.document_folder_items AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM document_folders
  WHERE ((document_folders.id = document_folder_items.folder_id) AND (document_folders.user_id = auth.uid())))));"
"CREATE POLICY ""Users can create their own folders"" ON public.document_folders AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete their own folders"" ON public.document_folders AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update their own folders"" ON public.document_folders AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view their own folders"" ON public.document_folders AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY document_folders_delete_own ON public.document_folders AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY document_folders_insert_own ON public.document_folders AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY document_folders_select_own ON public.document_folders AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY document_folders_update_own ON public.document_folders AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can create their own documents"" ON public.documents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete their own documents"" ON public.documents AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update their own documents"" ON public.documents AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view their own documents"" ON public.documents AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY allow_read_for_owners_and_shared_via_chat ON public.documents AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((social_chat_message_resources r
     JOIN social_chat_messages m ON ((m.id = r.message_id)))
     JOIN social_chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((r.resource_id = documents.id) AND ((r.resource_type)::text = 'documents'::text) AND ((((s.chat_type)::text = 'p2p'::text) AND ((s.user_id1 = auth.uid()) OR (s.user_id2 = auth.uid()))) OR (((s.chat_type)::text = 'group'::text) AND (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))))));"
"CREATE POLICY allow_read_for_owners_and_shared_via_chat_documents_fix ON public.documents AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((social_chat_message_resources r
     JOIN social_chat_messages m ON ((m.id = r.message_id)))
     JOIN social_chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((r.resource_id = documents.id) AND ((r.resource_type)::text = ANY (ARRAY[('document'::character varying)::text, ('documents'::character varying)::text])) AND ((((s.chat_type)::text = 'p2p'::text) AND ((s.user_id1 = auth.uid()) OR (s.user_id2 = auth.uid()))) OR (((s.chat_type)::text = 'group'::text) AND (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))))));"
"CREATE POLICY documents_delete_own ON public.documents AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY documents_insert_own ON public.documents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY documents_select_own ON public.documents AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY documents_select_public_course_materials ON public.documents AS PERMISSIVE FOR SELECT TO public
  USING (((is_public = true) OR (EXISTS ( SELECT 1
   FROM course_materials cm
  WHERE (cm.document_id = documents.id)))));"
"CREATE POLICY documents_update_own ON public.documents AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_documents ON public.documents AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_documents ON public.documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_documents ON public.documents AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_documents ON public.documents AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can manage education levels"" ON public.education_levels AS PERMISSIVE FOR ALL TO public
  USING (is_admin());"
"CREATE POLICY ""Anyone can read active education levels"" ON public.education_levels AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));"
"CREATE POLICY error_logs_service_role ON public.error_logs AS PERMISSIVE FOR ALL TO service_role
  USING (true);"
"CREATE POLICY super_admin_delete_error_logs ON public.error_logs AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_error_logs ON public.error_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_error_logs ON public.error_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_error_logs ON public.error_logs AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can manage examinations"" ON public.examinations AS PERMISSIVE FOR ALL TO public
  USING (is_admin());"
"CREATE POLICY ""Anyone can read active examinations"" ON public.examinations AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));"
"CREATE POLICY ""Owners can delete own failed_chunks"" ON public.failed_chunks AS PERMISSIVE FOR DELETE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = document_id));"
"CREATE POLICY ""Owners can insert failed_chunks"" ON public.failed_chunks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = document_id));"
"CREATE POLICY ""Owners can update own failed_chunks"" ON public.failed_chunks AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = document_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = document_id));"
"CREATE POLICY ""Owners can view own failed_chunks"" ON public.failed_chunks AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = document_id));"
"CREATE POLICY failed_chunks_delete ON public.failed_chunks AS PERMISSIVE FOR DELETE TO authenticated
  USING (((document_id IS NULL) OR (document_id IN ( SELECT documents.id
   FROM documents
  WHERE (documents.user_id = ( SELECT auth.uid() AS uid))))));"
"CREATE POLICY failed_chunks_insert ON public.failed_chunks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((document_id IS NULL) OR (document_id IN ( SELECT documents.id
   FROM documents
  WHERE (documents.user_id = ( SELECT auth.uid() AS uid))))));"
"CREATE POLICY failed_chunks_select ON public.failed_chunks AS PERMISSIVE FOR SELECT TO authenticated
  USING (((document_id IS NULL) OR (document_id IN ( SELECT documents.id
   FROM documents
  WHERE (documents.user_id = ( SELECT auth.uid() AS uid))))));"
"CREATE POLICY failed_chunks_update ON public.failed_chunks AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((document_id IS NULL) OR (document_id IN ( SELECT documents.id
   FROM documents
  WHERE (documents.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK (((document_id IS NULL) OR (document_id IN ( SELECT documents.id
   FROM documents
  WHERE (documents.user_id = ( SELECT auth.uid() AS uid))))));"
"CREATE POLICY super_admin_delete_failed_chunks ON public.failed_chunks AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_failed_chunks ON public.failed_chunks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_failed_chunks ON public.failed_chunks AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_failed_chunks ON public.failed_chunks AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Users can delete their own flashcards"" ON public.flashcards AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can insert their own flashcards"" ON public.flashcards AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update their own flashcards"" ON public.flashcards AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view their own flashcards"" ON public.flashcards AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY flashcards_delete_own ON public.flashcards AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY flashcards_insert_own ON public.flashcards AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY flashcards_select_own ON public.flashcards AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY flashcards_update_own ON public.flashcards AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY invites_delete_admin ON public.institution_invites AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM institution_members im
  WHERE ((im.user_id = auth.uid()) AND (im.institution_id = institution_invites.institution_id) AND (im.status = 'active'::text) AND (im.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'admin'::text))))));"
"CREATE POLICY invites_insert_admin ON public.institution_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM institution_members im
  WHERE ((im.user_id = auth.uid()) AND (im.institution_id = institution_invites.institution_id) AND (im.status = 'active'::text) AND (im.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'admin'::text))))));"
"CREATE POLICY invites_select_admin_or_recipient ON public.institution_invites AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM institution_members im
  WHERE ((im.user_id = auth.uid()) AND (im.institution_id = institution_invites.institution_id) AND (im.status = 'active'::text) AND (im.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'admin'::text))))));"
"CREATE POLICY invites_update_admin ON public.institution_invites AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM institution_members im
  WHERE ((im.user_id = auth.uid()) AND (im.institution_id = institution_invites.institution_id) AND (im.status = 'active'::text) AND (im.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'admin'::text))))));"
"CREATE POLICY members_delete_owner_or_self ON public.institution_members AS PERMISSIVE FOR DELETE TO public
  USING (((user_id = auth.uid()) OR is_institution_member(auth.uid(), institution_id, 'owner'::text)));"
"CREATE POLICY members_insert_admin_or_self ON public.institution_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_institution_member(auth.uid(), institution_id, 'admin'::text) OR (user_id = auth.uid())));"
"CREATE POLICY members_select_same_institution ON public.institution_members AS PERMISSIVE FOR SELECT TO public
  USING (((institution_id IN ( SELECT user_institution_ids(auth.uid()) AS user_institution_ids)) OR (user_id = auth.uid()) OR is_admin()));"
"CREATE POLICY members_update_admin ON public.institution_members AS PERMISSIVE FOR UPDATE TO public
  USING (is_institution_member(auth.uid(), institution_id, 'admin'::text))
  WITH CHECK (is_institution_member(auth.uid(), institution_id, 'admin'::text));"
"CREATE POLICY institutions_insert_authenticated ON public.institutions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'authenticated'::text));"
"CREATE POLICY institutions_select_active ON public.institutions AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR is_institution_member(auth.uid(), id, 'admin'::text) OR is_admin()));"
"CREATE POLICY institutions_update_admin ON public.institutions AS PERMISSIVE FOR UPDATE TO public
  USING ((is_institution_member(auth.uid(), id, 'admin'::text) OR is_admin()))
  WITH CHECK ((is_institution_member(auth.uid(), id, 'admin'::text) OR is_admin()));"
"CREATE POLICY learning_topic_connections_delete_own ON public.learning_topic_connections AS PERMISSIVE FOR DELETE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY learning_topic_connections_insert_own ON public.learning_topic_connections AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY learning_topic_connections_select_own ON public.learning_topic_connections AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY learning_topic_connections_update_own ON public.learning_topic_connections AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ""Anyone can view answers"" ON public.live_quiz_answers AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);"
"CREATE POLICY ""Users can submit answers"" ON public.live_quiz_answers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));"
"CREATE POLICY ""Users can update own answers"" ON public.live_quiz_answers AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()));"
"CREATE POLICY ""Anyone can view players"" ON public.live_quiz_players AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);"
"CREATE POLICY ""Authenticated can join as own player"" ON public.live_quiz_players AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete own player"" ON public.live_quiz_players AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));"
"CREATE POLICY ""Users can update own player"" ON public.live_quiz_players AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()));"
"CREATE POLICY ""Anyone can view questions"" ON public.live_quiz_questions AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);"
"CREATE POLICY ""Host can create questions"" ON public.live_quiz_questions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((session_id IN ( SELECT s.id
   FROM live_quiz_sessions s
  WHERE (s.host_user_id = auth.uid()))));"
"CREATE POLICY ""Host can update questions"" ON public.live_quiz_questions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM live_quiz_sessions
  WHERE ((live_quiz_sessions.id = live_quiz_questions.session_id) AND (live_quiz_sessions.host_user_id = auth.uid())))));"
"CREATE POLICY ""Anyone can view sessions"" ON public.live_quiz_sessions AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);"
"CREATE POLICY ""Authenticated can create own sessions"" ON public.live_quiz_sessions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = host_user_id));"
"CREATE POLICY ""Host can delete own sessions"" ON public.live_quiz_sessions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((host_user_id = auth.uid()));"
"CREATE POLICY ""Host can update own sessions"" ON public.live_quiz_sessions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((host_user_id = auth.uid()));"
"CREATE POLICY ""Allow read for owners and shared documents via chat"" ON public.notes AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((social_chat_message_resources r
     JOIN social_chat_messages m ON ((m.id = r.message_id)))
     JOIN social_chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((r.resource_id = notes.id) AND ((r.resource_type)::text = 'documents'::text) AND ((((s.chat_type)::text = 'p2p'::text) AND ((s.user_id1 = auth.uid()) OR (s.user_id2 = auth.uid()))) OR (((s.chat_type)::text = 'group'::text) AND (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))))));"
"CREATE POLICY ""Allow read for owners and shared via chat"" ON public.notes AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((social_chat_message_resources r
     JOIN social_chat_messages m ON ((m.id = r.message_id)))
     JOIN social_chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((r.resource_id = notes.id) AND ((r.resource_type)::text = 'note'::text) AND ((((s.chat_type)::text = 'p2p'::text) AND ((s.user_id1 = auth.uid()) OR (s.user_id2 = auth.uid()))) OR (((s.chat_type)::text = 'group'::text) AND (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))))));"
"CREATE POLICY ""Users can create own notes"" ON public.notes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete own notes"" ON public.notes AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own notes"" ON public.notes AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own notes"" ON public.notes AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notes_delete_own ON public.notes AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notes_insert_own ON public.notes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY notes_select_own_or_course ON public.notes AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM (course_resources cr
     JOIN course_enrollments ce ON ((ce.course_id = cr.course_id)))
  WHERE ((cr.resource_id = notes.id) AND (cr.resource_type = 'note'::text) AND (ce.user_id = auth.uid()) AND (ce.status = ANY (ARRAY['active'::text, 'completed'::text])))))));"
"CREATE POLICY notes_update_own ON public.notes AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_notes ON public.notes AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_notes ON public.notes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_notes ON public.notes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_notes ON public.notes AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Users can insert own preferences"" ON public.notification_preferences AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own preferences"" ON public.notification_preferences AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own preferences"" ON public.notification_preferences AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notification_prefs_insert_own ON public.notification_preferences AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY notification_prefs_select_own ON public.notification_preferences AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notification_prefs_update_own ON public.notification_preferences AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete their own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can insert own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can insert their own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update their own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view their own subscriptions"" ON public.notification_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notification_subs_delete_own ON public.notification_subscriptions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notification_subs_insert_own ON public.notification_subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY notification_subs_select_own ON public.notification_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notification_subs_update_own ON public.notification_subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY notifications_delete_own ON public.notifications AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notifications_insert_own ON public.notifications AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY notifications_select_own ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY notifications_update_own ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_notifications ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_notifications ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_notifications ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_notifications ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = auth.uid()) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY admin_view_all_reads ON public.platform_update_reads AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid()))));"
"CREATE POLICY users_manage_own_reads ON public.platform_update_reads AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));"
"CREATE POLICY admin_full_access_platform_updates ON public.platform_updates AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = auth.uid()))));"
"CREATE POLICY users_read_published_updates ON public.platform_updates AS PERMISSIVE FOR SELECT TO public
  USING (((auth.role() = 'authenticated'::text) AND (status = 'published'::text)));"
"CREATE POLICY ""Uploader can insert podcast chunks"" ON public.podcast_chunks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = uploader_user_id) OR (uploader_user_id IS NULL)));"
"CREATE POLICY ""Uploader can update podcast chunks"" ON public.podcast_chunks AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid() = uploader_user_id) OR (uploader_user_id IS NULL)))
  WITH CHECK (((auth.uid() = uploader_user_id) OR (uploader_user_id IS NULL)));"
"CREATE POLICY podcast_chunks_insert_own ON public.podcast_chunks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = uploader_user_id));"
"CREATE POLICY podcast_chunks_select_own ON public.podcast_chunks AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = uploader_user_id));"
"CREATE POLICY podcast_chunks_update_own ON public.podcast_chunks AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = uploader_user_id))
  WITH CHECK ((auth.uid() = uploader_user_id));"
"CREATE POLICY podcast_cohosts_delete_own ON public.podcast_cohosts AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY podcast_cohosts_insert_own ON public.podcast_cohosts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY podcast_cohosts_select_auth ON public.podcast_cohosts AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY ""Admins can manage credit packs"" ON public.podcast_credit_packs AS PERMISSIVE FOR ALL TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Anyone can read active credit packs"" ON public.podcast_credit_packs AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));"
"CREATE POLICY ""Admins can read all transactions"" ON public.podcast_credit_transactions AS PERMISSIVE FOR SELECT TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Users can read own transactions"" ON public.podcast_credit_transactions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Admins can read all credits"" ON public.podcast_credits AS PERMISSIVE FOR SELECT TO public
  USING (is_admin(auth.uid()));"
"CREATE POLICY ""Service role manages credits"" ON public.podcast_credits AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can read own credits"" ON public.podcast_credits AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Co-hosts can send invitations"" ON public.podcast_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((inviter_id = auth.uid()) AND check_user_is_cohost(podcast_id, auth.uid())));"
"CREATE POLICY ""Invitees can update their invitation status"" ON public.podcast_invites AS PERMISSIVE FOR UPDATE TO public
  USING ((invitee_id = auth.uid()))
  WITH CHECK (((invitee_id = auth.uid()) AND (status = ANY (ARRAY['accepted'::text, 'declined'::text]))));"
"CREATE POLICY ""Owner or co-host can invite"" ON public.podcast_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM ai_podcasts
  WHERE ((ai_podcasts.id = podcast_invites.podcast_id) AND (ai_podcasts.user_id = auth.uid())))) OR check_user_is_cohost(podcast_id, auth.uid())));"
"CREATE POLICY ""Podcast owners and co-hosts can send invitations"" ON public.podcast_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((inviter_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM ai_podcasts
  WHERE ((ai_podcasts.id = podcast_invites.podcast_id) AND (ai_podcasts.user_id = auth.uid()))))));"
"CREATE POLICY ""Users can respond to invites"" ON public.podcast_invites AS PERMISSIVE FOR UPDATE TO public
  USING (((invitee_id = auth.uid()) OR (invitee_email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text)));"
"CREATE POLICY ""Users can view their invites"" ON public.podcast_invites AS PERMISSIVE FOR SELECT TO public
  USING (((invitee_id = auth.uid()) OR (invitee_email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text)));"
"CREATE POLICY podcast_invites_insert_own ON public.podcast_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = inviter_id));"
"CREATE POLICY podcast_invites_select_own ON public.podcast_invites AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id)));"
"CREATE POLICY podcast_invites_update_own ON public.podcast_invites AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id)));"
"CREATE POLICY podcast_owners_and_cohosts_can_send_invitations ON public.podcast_invites AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((inviter_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_invites.podcast_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR check_user_is_cohost(podcast_id, ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY ""Users can join as listeners"" ON public.podcast_listeners AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));"
"CREATE POLICY ""Users can update their listener status"" ON public.podcast_listeners AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()));"
"CREATE POLICY ""Users can view podcast listeners"" ON public.podcast_listeners AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_listeners.podcast_id) AND ((p.is_public = true) OR (p.user_id = auth.uid()))))));"
"CREATE POLICY ""Owners can manage podcast members"" ON public.podcast_members AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_members.podcast_id) AND (p.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_members.podcast_id) AND (p.user_id = auth.uid())))));"
"CREATE POLICY ""Podcast owner can manage members"" ON public.podcast_members AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts
  WHERE ((ai_podcasts.id = podcast_members.podcast_id) AND (ai_podcasts.user_id = auth.uid())))));"
"CREATE POLICY ""Users can view podcast members"" ON public.podcast_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_members.podcast_id) AND ((p.is_public = true) OR (p.user_id = ( SELECT auth.uid() AS uid))))))));"
"CREATE POLICY ""Users can view their own membership"" ON public.podcast_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY podcast_members_delete_own ON public.podcast_members AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY podcast_members_insert_own ON public.podcast_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY podcast_members_select_auth ON public.podcast_members AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY ""Hosts can update requests"" ON public.podcast_participation_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_participation_requests.podcast_id) AND (p.user_id = auth.uid())))));"
"CREATE POLICY ""Hosts can view podcast requests"" ON public.podcast_participation_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_participation_requests.podcast_id) AND (p.user_id = auth.uid())))));"
"CREATE POLICY ""Users can insert own requests"" ON public.podcast_participation_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own requests"" ON public.podcast_participation_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Mod access on recordings"" ON public.podcast_recordings AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_recordings.podcast_id) AND (p.user_id = auth.uid())))));"
"CREATE POLICY ""Owner can manage own recordings"" ON public.podcast_recordings AS PERMISSIVE FOR ALL TO authenticated
  USING (((auth.uid() = user_id) OR (user_id IS NULL) OR (EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_recordings.podcast_id) AND (p.user_id = auth.uid()))))))
  WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL) OR (EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_recordings.podcast_id) AND (p.user_id = auth.uid()))))));"
"CREATE POLICY podcast_recordings_delete_own ON public.podcast_recordings AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY podcast_recordings_insert_own ON public.podcast_recordings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY podcast_recordings_select_own ON public.podcast_recordings AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_recordings.podcast_id) AND ((p.user_id = auth.uid()) OR (p.is_public = true)))))));"
"CREATE POLICY podcast_recordings_update_own ON public.podcast_recordings AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can share podcasts"" ON public.podcast_shares AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));"
"CREATE POLICY ""Users can view podcast shares"" ON public.podcast_shares AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ai_podcasts p
  WHERE ((p.id = podcast_shares.podcast_id) AND ((p.user_id = auth.uid()) OR (p.is_public = true))))));"
"CREATE POLICY ""Users can insert own profile"" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));"
"CREATE POLICY ""Users can update own profile"" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));"
"CREATE POLICY ""Users can view own profile"" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));"
"CREATE POLICY profiles_delete_own ON public.profiles AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = id));"
"CREATE POLICY profiles_insert_own ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));"
"CREATE POLICY profiles_select_authenticated ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY profiles_update_admin ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.is_active = true)))));"
"CREATE POLICY profiles_update_own ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));"
"CREATE POLICY profiles_update_own_restricted ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id))
  WITH CHECK (((auth.uid() = id) AND ((NOT (user_role IS DISTINCT FROM current_user_role())) OR (user_role = 'student'::text))));"
"CREATE POLICY super_admin_delete_profiles ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_profiles ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_profiles ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_profiles ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Users can insert own quiz attempts"" ON public.quiz_attempts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own quiz attempts"" ON public.quiz_attempts AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY quiz_attempts_insert_own ON public.quiz_attempts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY quiz_attempts_update_own ON public.quiz_attempts AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can create own quizzes"" ON public.quizzes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete own quizzes"" ON public.quizzes AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own quizzes"" ON public.quizzes AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own quizzes"" ON public.quizzes AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY quizzes_delete_own ON public.quizzes AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY quizzes_insert_own ON public.quizzes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY quizzes_select_own ON public.quizzes AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY quizzes_update_own ON public.quizzes AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_quizzes ON public.quizzes AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_quizzes ON public.quizzes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_quizzes ON public.quizzes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_quizzes ON public.quizzes AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Block client inserts on referrals"" ON public.referrals AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (false);"
"CREATE POLICY ""Block client updates on referrals"" ON public.referrals AS PERMISSIVE FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);"
"CREATE POLICY ""Users can view referrals they made"" ON public.referrals AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = referrer_id));"
"CREATE POLICY ""Users can view referrals they received"" ON public.referrals AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = referee_id));"
"CREATE POLICY rvr_insert_own ON public.role_verification_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY rvr_select_admin ON public.role_verification_requests AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.is_active = true)))));"
"CREATE POLICY rvr_select_own ON public.role_verification_requests AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY rvr_update_admin ON public.role_verification_requests AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.is_active = true)))));"
"CREATE POLICY rvr_update_own ON public.role_verification_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = user_id) AND (status = 'pending'::text)));"
"CREATE POLICY ""Users can create own schedule items"" ON public.schedule_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can delete own schedule items"" ON public.schedule_items AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own schedule items"" ON public.schedule_items AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own schedule"" ON public.schedule_items AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY schedule_items_delete_own ON public.schedule_items AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY schedule_items_insert_own ON public.schedule_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY schedule_items_select_own ON public.schedule_items AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY schedule_items_update_own ON public.schedule_items AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_schedule_items ON public.schedule_items AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_schedule_items ON public.schedule_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_schedule_items ON public.schedule_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_schedule_items ON public.schedule_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Users can manage own schedule reminders"" ON public.schedule_reminders AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM schedule_items
  WHERE ((schedule_items.id = schedule_reminders.schedule_id) AND (schedule_items.user_id = auth.uid())))));"
"CREATE POLICY ""Users can view own schedule reminders"" ON public.schedule_reminders AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM schedule_items
  WHERE ((schedule_items.id = schedule_reminders.schedule_id) AND (schedule_items.user_id = auth.uid())))));"
"CREATE POLICY ""Users can view their own audit logs"" ON public.schema_agent_audit AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY schema_agent_audit_select_own ON public.schema_agent_audit AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR is_admin()));"
"CREATE POLICY ""Allow public read access"" ON public.social_bookmarks AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY ""Enable delete for own bookmarks"" ON public.social_bookmarks AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_bookmarks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_bookmarks AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY social_bookmarks_delete_own ON public.social_bookmarks AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_bookmarks_insert_own ON public.social_bookmarks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY social_bookmarks_select_own ON public.social_bookmarks AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_social_bookmarks ON public.social_bookmarks AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_bookmarks ON public.social_bookmarks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_bookmarks ON public.social_bookmarks AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_bookmarks ON public.social_bookmarks AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Users can delete their own media"" ON public.social_chat_message_media AS PERMISSIVE FOR DELETE TO authenticated
  USING ((message_id IN ( SELECT social_chat_messages.id
   FROM social_chat_messages
  WHERE (social_chat_messages.sender_id = auth.uid()))));"
"CREATE POLICY ""Users can update their own media"" ON public.social_chat_message_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((message_id IN ( SELECT social_chat_messages.id
   FROM social_chat_messages
  WHERE (social_chat_messages.sender_id = auth.uid()))));"
"CREATE POLICY ""Users can view media in their chat sessions"" ON public.social_chat_message_media AS PERMISSIVE FOR SELECT TO authenticated
  USING ((message_id IN ( SELECT cm.id
   FROM (social_chat_messages cm
     JOIN social_chat_sessions cs ON ((cm.session_id = cs.id)))
  WHERE ((cs.user_id1 = auth.uid()) OR (cs.user_id2 = auth.uid()) OR ((cs.group_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM social_group_members
          WHERE ((social_group_members.group_id = cs.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))))));"
"CREATE POLICY social_chat_message_media_insert ON public.social_chat_message_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((message_id IN ( SELECT social_chat_messages.id
   FROM social_chat_messages
  WHERE (social_chat_messages.sender_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY super_admin_delete_social_chat_message_media ON public.social_chat_message_media AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_chat_message_media ON public.social_chat_message_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_chat_message_media ON public.social_chat_message_media AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_chat_message_media ON public.social_chat_message_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY reads_delete_owner ON public.social_chat_message_reads AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY reads_insert_owner ON public.social_chat_message_reads AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY reads_select_admin ON public.social_chat_message_reads AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt() ->> 'user_role'::text) = 'admin'::text));"
"CREATE POLICY reads_select_owner ON public.social_chat_message_reads AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY reads_update_owner ON public.social_chat_message_reads AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_chat_reads_insert_own ON public.social_chat_message_reads AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY social_chat_reads_select_own ON public.social_chat_message_reads AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_chat_reads_update_own ON public.social_chat_message_reads AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can add resources to messages they sent"" ON public.social_chat_message_resources AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM social_chat_messages
  WHERE ((social_chat_messages.id = social_chat_message_resources.message_id) AND (social_chat_messages.sender_id = auth.uid())))));"
"CREATE POLICY ""Users can view message resources in their chats"" ON public.social_chat_message_resources AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (social_chat_messages cm
     JOIN social_chat_sessions cs ON ((cm.session_id = cs.id)))
  WHERE ((cm.id = social_chat_message_resources.message_id) AND ((cs.user_id1 = auth.uid()) OR (cs.user_id2 = auth.uid()) OR (EXISTS ( SELECT 1
           FROM social_group_members
          WHERE ((social_group_members.group_id = cs.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))))));"
"CREATE POLICY ""Users can delete their own messages"" ON public.social_chat_messages AS PERMISSIVE FOR DELETE TO public
  USING ((sender_id = auth.uid()));"
"CREATE POLICY ""Users can insert messages"" ON public.social_chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((sender_id = auth.uid()) AND (session_id IN ( SELECT social_chat_sessions.id
   FROM social_chat_sessions
  WHERE ((social_chat_sessions.user_id1 = auth.uid()) OR (social_chat_sessions.user_id2 = auth.uid()) OR (((social_chat_sessions.chat_type)::text = 'group'::text) AND (social_chat_sessions.group_id IN ( SELECT social_group_members.group_id
           FROM social_group_members
          WHERE ((social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text))))))))));"
"CREATE POLICY ""Users can send chat messages"" ON public.social_chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((sender_id = auth.uid()) AND (((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_group_members
  WHERE ((social_group_members.group_id = social_chat_messages.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text))))) OR ((session_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_chat_sessions cs
  WHERE ((cs.id = social_chat_messages.session_id) AND ((cs.user_id1 = auth.uid()) OR (cs.user_id2 = auth.uid()) OR (EXISTS ( SELECT 1
           FROM social_group_members
          WHERE ((social_group_members.group_id = cs.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text))))))))))));"
"CREATE POLICY ""Users can update their own messages"" ON public.social_chat_messages AS PERMISSIVE FOR UPDATE TO public
  USING ((sender_id = auth.uid()))
  WITH CHECK ((sender_id = auth.uid()));"
"CREATE POLICY ""Users can view chat messages"" ON public.social_chat_messages AS PERMISSIVE FOR SELECT TO public
  USING ((((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_group_members
  WHERE ((social_group_members.group_id = social_chat_messages.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text))))) OR ((session_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_chat_sessions cs
  WHERE ((cs.id = social_chat_messages.session_id) AND ((cs.user_id1 = auth.uid()) OR (cs.user_id2 = auth.uid()) OR (EXISTS ( SELECT 1
           FROM social_group_members
          WHERE ((social_group_members.group_id = cs.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))))))));"
"CREATE POLICY ""Users can view their chat messages"" ON public.social_chat_messages AS PERMISSIVE FOR SELECT TO public
  USING ((session_id IN ( SELECT social_chat_sessions.id
   FROM social_chat_sessions
  WHERE ((social_chat_sessions.user_id1 = auth.uid()) OR (social_chat_sessions.user_id2 = auth.uid()) OR (((social_chat_sessions.chat_type)::text = 'group'::text) AND (social_chat_sessions.group_id IN ( SELECT social_group_members.group_id
           FROM social_group_members
          WHERE ((social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))))));"
"CREATE POLICY ""group members can read social chat messages"" ON public.social_chat_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (((sender_id = ( SELECT auth.uid() AS uid)) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_group_members gm
  WHERE ((gm.group_id = social_chat_messages.group_id) AND (gm.user_id = ( SELECT auth.uid() AS uid)) AND (gm.status = 'active'::text)))))));"
"CREATE POLICY social_chat_messages_delete ON public.social_chat_messages AS PERMISSIVE FOR DELETE TO authenticated
  USING ((sender_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_chat_messages_delete_own ON public.social_chat_messages AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = sender_id));"
"CREATE POLICY social_chat_messages_insert ON public.social_chat_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((sender_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_chat_messages_insert_own ON public.social_chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = sender_id));"
"CREATE POLICY social_chat_messages_select ON public.social_chat_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((sender_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_chat_messages_select_participant ON public.social_chat_messages AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM social_chat_sessions s
  WHERE ((s.id = social_chat_messages.session_id) AND ((s.user_id1 = auth.uid()) OR (s.user_id2 = auth.uid()) OR (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))));"
"CREATE POLICY social_chat_messages_update ON public.social_chat_messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((sender_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((sender_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_chat_messages_update_own ON public.social_chat_messages AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = sender_id))
  WITH CHECK ((auth.uid() = sender_id));"
"CREATE POLICY super_admin_delete_social_chat_messages ON public.social_chat_messages AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_chat_messages ON public.social_chat_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_chat_messages ON public.social_chat_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_chat_messages ON public.social_chat_messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Users can create p2p sessions"" ON public.social_chat_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((chat_type)::text = 'p2p'::text) AND ((auth.uid() = user_id1) OR (auth.uid() = user_id2))));"
"CREATE POLICY ""Users can create sessions"" ON public.social_chat_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((((chat_type)::text = 'p2p'::text) AND ((user_id1 = auth.uid()) OR (user_id2 = auth.uid()))) OR (((chat_type)::text = 'group'::text) AND (group_id IN ( SELECT social_group_members.group_id
   FROM social_group_members
  WHERE ((social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))));"
"CREATE POLICY ""Users can update their own sessions"" ON public.social_chat_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = user_id1) OR (auth.uid() = user_id2) OR (EXISTS ( SELECT 1
   FROM social_group_members
  WHERE ((social_group_members.group_id = social_chat_sessions.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))));"
"CREATE POLICY ""Users can update their sessions"" ON public.social_chat_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id1 = auth.uid()) OR (user_id2 = auth.uid()) OR (((chat_type)::text = 'group'::text) AND (group_id IN ( SELECT social_group_members.group_id
   FROM social_group_members
  WHERE ((social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))));"
"CREATE POLICY ""Users can view their own chat sessions"" ON public.social_chat_sessions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id1) OR (auth.uid() = user_id2) OR (EXISTS ( SELECT 1
   FROM social_group_members
  WHERE ((social_group_members.group_id = social_chat_sessions.group_id) AND (social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text))))));"
"CREATE POLICY ""Users can view their sessions"" ON public.social_chat_sessions AS PERMISSIVE FOR SELECT TO public
  USING (((user_id1 = auth.uid()) OR (user_id2 = auth.uid()) OR (((chat_type)::text = 'group'::text) AND (group_id IN ( SELECT social_group_members.group_id
   FROM social_group_members
  WHERE ((social_group_members.user_id = auth.uid()) AND (social_group_members.status = 'active'::text)))))));"
"CREATE POLICY social_chat_sessions_insert_participant ON public.social_chat_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id1) OR (auth.uid() = user_id2)));"
"CREATE POLICY social_chat_sessions_select_participant ON public.social_chat_sessions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id1) OR (auth.uid() = user_id2) OR (EXISTS ( SELECT 1
   FROM social_group_members gm
  WHERE ((gm.group_id = social_chat_sessions.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text))))));"
"CREATE POLICY social_chat_sessions_update_participant ON public.social_chat_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = user_id1) OR (auth.uid() = user_id2)));"
"CREATE POLICY social_comment_media_delete ON public.social_comment_media AS PERMISSIVE FOR DELETE TO authenticated
  USING ((comment_id IN ( SELECT social_comments.id
   FROM social_comments
  WHERE (social_comments.author_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY social_comment_media_insert ON public.social_comment_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((comment_id IN ( SELECT social_comments.id
   FROM social_comments
  WHERE (social_comments.author_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY social_comment_media_select ON public.social_comment_media AS PERMISSIVE FOR SELECT TO authenticated
  USING ((comment_id IN ( SELECT social_comments.id
   FROM social_comments
  WHERE (social_comments.author_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY social_comment_media_update ON public.social_comment_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((comment_id IN ( SELECT social_comments.id
   FROM social_comments
  WHERE (social_comments.author_id = ( SELECT auth.uid() AS uid)))))
  WITH CHECK ((comment_id IN ( SELECT social_comments.id
   FROM social_comments
  WHERE (social_comments.author_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY super_admin_delete_social_comment_media ON public.social_comment_media AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_comment_media ON public.social_comment_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_comment_media ON public.social_comment_media AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_comment_media ON public.social_comment_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable delete for comment authors"" ON public.social_comments AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = author_id));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_comments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_comments AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Enable update for comment authors"" ON public.social_comments AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = author_id));"
"CREATE POLICY social_comments_delete ON public.social_comments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((author_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_comments_delete_own ON public.social_comments AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = author_id));"
"CREATE POLICY social_comments_insert ON public.social_comments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((author_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_comments_insert_own ON public.social_comments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = author_id));"
"CREATE POLICY social_comments_select ON public.social_comments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((author_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_comments_select_auth ON public.social_comments AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_comments_update ON public.social_comments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((author_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((author_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_comments_update_own ON public.social_comments AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = author_id))
  WITH CHECK ((auth.uid() = author_id));"
"CREATE POLICY super_admin_delete_social_comments ON public.social_comments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_comments ON public.social_comments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_comments ON public.social_comments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_comments ON public.social_comments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""group members can read social_event_attendees"" ON public.social_event_attendees AS PERMISSIVE FOR SELECT TO authenticated
  USING (((event_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_events se
  WHERE ((se.id = social_event_attendees.event_id) AND ((se.organizer_id = ( SELECT auth.uid() AS uid)) OR ((se.group_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM social_group_members gm
          WHERE ((gm.group_id = se.group_id) AND (gm.user_id = ( SELECT auth.uid() AS uid)) AND (gm.status = 'active'::text)))))))))));"
"CREATE POLICY social_event_attendees_delete ON public.social_event_attendees AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_event_attendees_insert ON public.social_event_attendees AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_event_attendees_select ON public.social_event_attendees AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_event_attendees_update ON public.social_event_attendees AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY super_admin_delete_social_event_attendees ON public.social_event_attendees AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_event_attendees ON public.social_event_attendees AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_event_attendees ON public.social_event_attendees AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_event_attendees ON public.social_event_attendees AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""group members can read social events"" ON public.social_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizer_id = ( SELECT auth.uid() AS uid)) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM social_group_members gm
  WHERE ((gm.group_id = social_events.group_id) AND (gm.user_id = ( SELECT auth.uid() AS uid)) AND (gm.status = 'active'::text)))))));"
"CREATE POLICY social_events_delete ON public.social_events AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizer_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_events_delete_creator ON public.social_events AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = organizer_id));"
"CREATE POLICY social_events_insert ON public.social_events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizer_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_events_insert_auth ON public.social_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = organizer_id));"
"CREATE POLICY social_events_select ON public.social_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizer_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_events_select_auth ON public.social_events AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_events_update ON public.social_events AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizer_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((organizer_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_events_update_creator ON public.social_events AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = organizer_id))
  WITH CHECK ((auth.uid() = organizer_id));"
"CREATE POLICY super_admin_delete_social_events ON public.social_events AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_events ON public.social_events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_events ON public.social_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_events ON public.social_events AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable delete for own follows"" ON public.social_follows AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = follower_id));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_follows AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = follower_id));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_follows AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY social_follows_delete_own ON public.social_follows AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = follower_id));"
"CREATE POLICY social_follows_insert_own ON public.social_follows AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = follower_id));"
"CREATE POLICY social_follows_select_auth ON public.social_follows AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY super_admin_delete_social_follows ON public.social_follows AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_follows ON public.social_follows AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_follows ON public.social_follows AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_follows ON public.social_follows AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable delete for own membership"" ON public.social_group_members AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_group_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_group_members AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Enable update for own membership"" ON public.social_group_members AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_group_members_delete_own ON public.social_group_members AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_group_members_insert_own ON public.social_group_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY social_group_members_select_auth ON public.social_group_members AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_group_members_update_own ON public.social_group_members AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_social_group_members ON public.social_group_members AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_group_members ON public.social_group_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_group_members ON public.social_group_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_group_members ON public.social_group_members AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable delete for group creators"" ON public.social_groups AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = created_by));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_groups AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_groups AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Enable update for group creators"" ON public.social_groups AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = created_by));"
"CREATE POLICY social_groups_delete_creator ON public.social_groups AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = created_by));"
"CREATE POLICY social_groups_insert_auth ON public.social_groups AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = created_by));"
"CREATE POLICY social_groups_select_auth ON public.social_groups AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_groups_update_creator ON public.social_groups AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = created_by))
  WITH CHECK ((auth.uid() = created_by));"
"CREATE POLICY super_admin_delete_social_groups ON public.social_groups AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_groups ON public.social_groups AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_groups ON public.social_groups AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_groups ON public.social_groups AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY social_hashtags_insert_auth ON public.social_hashtags AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_hashtags_select_auth ON public.social_hashtags AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY super_admin_delete_social_hashtags ON public.social_hashtags AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_hashtags ON public.social_hashtags AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_hashtags ON public.social_hashtags AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_hashtags ON public.social_hashtags AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Allow public read access"" ON public.social_likes AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY ""Enable delete for own likes"" ON public.social_likes AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_likes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_likes AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY social_likes_delete_own ON public.social_likes AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_likes_insert_own ON public.social_likes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY social_likes_select_auth ON public.social_likes AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY super_admin_delete_social_likes ON public.social_likes AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_likes ON public.social_likes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_likes ON public.social_likes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_likes ON public.social_likes AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_media AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_media AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY super_admin_delete_social_media ON public.social_media AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_media ON public.social_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_media ON public.social_media AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_media ON public.social_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_notifications AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for own notifications"" ON public.social_notifications AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Enable update for own notifications"" ON public.social_notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_notifications_delete_own ON public.social_notifications AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_notifications_select_own ON public.social_notifications AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_notifications_update_own ON public.social_notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_social_notifications ON public.social_notifications AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_notifications ON public.social_notifications AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_notifications ON public.social_notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_notifications ON public.social_notifications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_post_hashtags AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_post_hashtags AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY super_admin_delete_social_post_hashtags ON public.social_post_hashtags AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_post_hashtags ON public.social_post_hashtags AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_post_hashtags ON public.social_post_hashtags AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_post_hashtags ON public.social_post_hashtags AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_post_tags AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_post_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY super_admin_delete_social_post_tags ON public.social_post_tags AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_post_tags ON public.social_post_tags AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_post_tags ON public.social_post_tags AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_post_tags ON public.social_post_tags AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Allow public read access"" ON public.social_post_views AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY ""Users can insert their own post views"" ON public.social_post_views AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view their own post views"" ON public.social_post_views AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY super_admin_delete_social_post_views ON public.social_post_views AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_post_views ON public.social_post_views AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_post_views ON public.social_post_views AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_post_views ON public.social_post_views AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY social_posts_delete_own ON public.social_posts AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = author_id));"
"CREATE POLICY social_posts_insert_own ON public.social_posts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = author_id));"
"CREATE POLICY social_posts_select_auth ON public.social_posts AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_posts_update_own ON public.social_posts AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = author_id))
  WITH CHECK ((auth.uid() = author_id));"
"CREATE POLICY super_admin_delete_social_posts ON public.social_posts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_posts ON public.social_posts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_posts ON public.social_posts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_posts ON public.social_posts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY social_reports_delete_admin ON public.social_reports AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));"
"CREATE POLICY social_reports_insert ON public.social_reports AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((reporter_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_reports_insert_auth ON public.social_reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = reporter_id));"
"CREATE POLICY social_reports_select_admin ON public.social_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));"
"CREATE POLICY social_reports_select_own ON public.social_reports AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = reporter_id) OR is_admin()));"
"CREATE POLICY social_reports_select_reporter ON public.social_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((reporter_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_reports_update_admin ON public.social_reports AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text))
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'admin'::text));"
"CREATE POLICY super_admin_delete_social_reports ON public.social_reports AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_reports ON public.social_reports AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_reports ON public.social_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_reports ON public.social_reports AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY social_shares_delete ON public.social_shares AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_shares_delete_own ON public.social_shares AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_shares_insert ON public.social_shares AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_shares_insert_own ON public.social_shares AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY social_shares_select ON public.social_shares AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY social_shares_select_auth ON public.social_shares AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_shares_update ON public.social_shares AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));"
"CREATE POLICY super_admin_delete_social_shares ON public.social_shares AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_shares ON public.social_shares AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_shares ON public.social_shares AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_shares ON public.social_shares AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Enable insert for authenticated users"" ON public.social_tags AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));"
"CREATE POLICY ""Enable read access for all users"" ON public.social_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY super_admin_delete_social_tags ON public.social_tags AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_tags ON public.social_tags AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_tags ON public.social_tags AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_tags ON public.social_tags AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Service role full access on signals"" ON public.social_user_signals AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));"
"CREATE POLICY ""Users can manage own signals"" ON public.social_user_signals AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY social_users_insert_own ON public.social_users AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));"
"CREATE POLICY social_users_select_auth ON public.social_users AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));"
"CREATE POLICY social_users_update_own ON public.social_users AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));"
"CREATE POLICY super_admin_delete_social_users ON public.social_users AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_insert_social_users ON public.social_users AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_select_social_users ON public.social_users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY super_admin_update_social_users ON public.social_users AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Admins can manage subjects"" ON public.subjects AS PERMISSIVE FOR ALL TO public
  USING (is_admin());"
"CREATE POLICY ""Anyone can read active subjects"" ON public.subjects AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));"
"CREATE POLICY ""Admins can manage subscriptions"" ON public.subscriptions AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = ( SELECT auth.uid() AS uid)) AND (admin_users.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = ( SELECT auth.uid() AS uid)) AND (admin_users.is_active = true)))));"
"CREATE POLICY ""Users can insert their own subscription"" ON public.subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update their own subscription"" ON public.subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view their own subscription"" ON public.subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY subscriptions_select_own ON public.subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Admins can read system error logs"" ON public.system_error_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.is_active = true)))));"
"CREATE POLICY ""Admins can update system error logs"" ON public.system_error_logs AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.is_active = true)))));"
"CREATE POLICY ""Service role can insert system error logs"" ON public.system_error_logs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);"
"CREATE POLICY ""Admins can view system settings"" ON public.system_settings AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND ((admin_users.role = 'super_admin'::admin_role) OR (admin_users.role = 'admin'::admin_role))))));"
"CREATE POLICY ""Service role can manage settings"" ON public.system_settings AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);"
"CREATE POLICY ""Super admins can delete settings"" ON public.system_settings AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Super admins can insert settings"" ON public.system_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Super admins can update settings"" ON public.system_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.role = 'super_admin'::admin_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Super admins can update system settings"" ON public.system_settings AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.role = 'super_admin'::admin_role)))));"
"CREATE POLICY ""Super admins can view settings"" ON public.system_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE ((admin_users.user_id = auth.uid()) AND (admin_users.role = ANY (ARRAY['super_admin'::admin_role, 'admin'::admin_role, 'moderator'::admin_role]))))));"
"CREATE POLICY admins_view_all_activity ON public.user_activity_tracking AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM admin_users
  WHERE (admin_users.user_id = ( SELECT auth.uid() AS uid)))));"
"CREATE POLICY system_update_activity ON public.user_activity_tracking AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);"
"CREATE POLICY users_view_own_activity ON public.user_activity_tracking AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY user_daily_activity_insert_own ON public.user_daily_activity AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY user_daily_activity_select_own ON public.user_daily_activity AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY user_daily_activity_update_own ON public.user_daily_activity AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Admins can read all education profiles"" ON public.user_education_profiles AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());"
"CREATE POLICY ""Users can insert own education profile"" ON public.user_education_profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own education profile"" ON public.user_education_profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view own education profile"" ON public.user_education_profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY user_learning_goals_delete_own ON public.user_learning_goals AS PERMISSIVE FOR DELETE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY user_learning_goals_insert_own ON public.user_learning_goals AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY user_learning_goals_select_own ON public.user_learning_goals AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY user_learning_goals_update_own ON public.user_learning_goals AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));"
"CREATE POLICY ""Users can insert own stats"" ON public.user_stats AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can update own stats"" ON public.user_stats AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY ""Users can view leaderboard stats"" ON public.user_stats AS PERMISSIVE FOR SELECT TO public
  USING (true);"
"CREATE POLICY ""Users can view own stats"" ON public.user_stats AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY user_stats_select_own ON public.user_stats AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));"
"CREATE POLICY user_stats_update_own ON public.user_stats AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));"
"CREATE POLICY ""Users can manage own subjects"" ON public.user_subjects AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM user_education_profiles uep
  WHERE ((uep.id = user_subjects.user_education_profile_id) AND (uep.user_id = auth.uid())))));"
  create policy "Users can view their own documents"
on storage.objects
for select
to public
using (
  (bucket_id = 'documents'::text)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);