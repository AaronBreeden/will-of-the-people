import { supabase } from "@/lib/supabaseClient";

export async function getUserWithRole() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) return null;

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("id", session.user.id)
    .single();

  if (error) return null;

  return user;
}