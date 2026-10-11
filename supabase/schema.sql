-- oprosnik: schema.sql
-- Supabase SQL Editor → вставить целиком → Run

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveys (
  id text PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  starts_at date,
  ends_at date,
  definition jsonb,
  version int NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id text NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  option_labels text[] NOT NULL DEFAULT '{}',
  value_text text,
  value_num numeric,
  comment text
);

CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator',
    false
  );
$$;

CREATE POLICY "profiles_select_self" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_mod_select_all" ON profiles
  FOR SELECT USING (is_moderator());

CREATE POLICY "surveys_select_all" ON surveys
  FOR SELECT USING (true);

CREATE POLICY "surveys_manage_mod" ON surveys
  FOR ALL USING (is_moderator()) WITH CHECK (is_moderator());

CREATE POLICY "responses_select_own" ON responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "responses_insert_own" ON responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "responses_mod_select_all" ON responses
  FOR SELECT USING (is_moderator());

CREATE POLICY "responses_mod_delete" ON responses
  FOR DELETE USING (is_moderator());

CREATE POLICY "answers_select_own" ON answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM responses r
      WHERE r.id = answers.response_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "answers_insert_own" ON answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM responses r
      WHERE r.id = answers.response_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "answers_mod_select_all" ON answers
  FOR SELECT USING (is_moderator());

CREATE POLICY "answers_mod_delete" ON answers
  FOR DELETE USING (is_moderator());

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, department, position)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'department', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'position', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
