UPDATE public.profiles p
SET display_name = COALESCE(
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'first_name','') || ' ' || COALESCE(u.raw_user_meta_data->>'last_name','')), ''),
      NULLIF(u.raw_user_meta_data->>'full_name',''),
      NULLIF(u.raw_user_meta_data->>'name',''),
      p.display_name
    ),
    first_name = COALESCE(
      NULLIF(p.first_name,''),
      NULLIF(u.raw_user_meta_data->>'first_name',''),
      NULLIF(split_part(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name',''), ' ', 1), '')
    ),
    last_name = COALESCE(
      NULLIF(p.last_name,''),
      NULLIF(u.raw_user_meta_data->>'last_name',''),
      NULLIF(split_part(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name',''), ' ', 2), '')
    )
FROM auth.users u
WHERE u.id = p.user_id
  AND p.display_name = split_part(u.email, '@', 1);