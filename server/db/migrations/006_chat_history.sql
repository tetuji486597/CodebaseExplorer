-- Recreate chat_messages with correct schema + unified history columns
DROP TABLE IF EXISTS chat_messages CASCADE;

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  context jsonb DEFAULT '{}',
  user_id uuid,
  source text DEFAULT 'web',
  session_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX chat_messages_project_idx ON chat_messages (project_id, created_at);
CREATE INDEX chat_messages_session_idx ON chat_messages (project_id, session_id, created_at);
CREATE INDEX chat_messages_source_idx ON chat_messages (project_id, source);
CREATE INDEX chat_messages_user_project_idx ON chat_messages (user_id, project_id, created_at DESC);

ALTER TABLE reports ADD CONSTRAINT reports_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL;
