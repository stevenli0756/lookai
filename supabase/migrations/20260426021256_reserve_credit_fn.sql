CREATE OR REPLACE FUNCTION public.reserve_credit_and_create_generation(
  p_user_id             UUID,
  p_model_object_key    TEXT,
  p_garment_object_key  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INT;
  v_generation_id UUID;
BEGIN
  -- Lock the profile row to prevent concurrent credit races
  SELECT credits_remaining
    INTO v_credits
    FROM public.profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_credits < 1 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  UPDATE public.profiles
     SET credits_remaining = credits_remaining - 1
   WHERE id = p_user_id;

  -- model_image_url / garment_image_url store R2 object keys (not URLs).
  -- Misleading column names inherited from Phase 1 spec; rename deferred to polish pass.
  INSERT INTO public.generations (
    user_id,
    model_image_url,
    garment_image_url,
    status,
    credits_used
  ) VALUES (
    p_user_id,
    p_model_object_key,
    p_garment_object_key,
    'pending',
    1
  )
  RETURNING id INTO v_generation_id;

  RETURN v_generation_id;
END;
$$;
