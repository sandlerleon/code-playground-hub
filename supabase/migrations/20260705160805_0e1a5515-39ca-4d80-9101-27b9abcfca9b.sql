
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL,
  chapter integer,
  mode text NOT NULL DEFAULT 'active',
  creator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO authenticated;
GRANT SELECT ON public.chat_rooms TO anon;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_read_all" ON public.chat_rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert_auth" ON public.chat_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "rooms_update_creator" ON public.chat_rooms FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "rooms_delete_creator" ON public.chat_rooms FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid,
  author_name text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_messages_room_created_idx ON public.room_messages(room_id, created_at);
GRANT SELECT, INSERT ON public.room_messages TO authenticated;
GRANT SELECT ON public.room_messages TO anon;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msgs_read_all" ON public.room_messages FOR SELECT USING (true);
CREATE POLICY "msgs_insert_auth" ON public.room_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
