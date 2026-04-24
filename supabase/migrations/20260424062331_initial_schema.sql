-- Create generation_status enum
CREATE TYPE public.generation_status AS ENUM ('pending', 'complete', 'failed');

-- profiles table
CREATE TABLE public.profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining INT         NOT NULL DEFAULT 10,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- generations table
CREATE TABLE public.generations (
  id                  UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID                     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_image_url     TEXT                     NOT NULL,
  garment_image_url   TEXT                     NOT NULL,
  result_image_url    TEXT,
  fashn_prediction_id TEXT,
  status              public.generation_status NOT NULL DEFAULT 'pending',
  error_message       TEXT,
  credits_used        INT                      NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- Indexes
CREATE INDEX generations_user_id_idx ON public.generations(user_id);
CREATE INDEX generations_status_idx  ON public.generations(status);

-- RLS
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_read_own_generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
