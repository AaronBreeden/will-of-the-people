import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabase();

  // Get the session from Supabase
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth");
  }

  const user = session.user;

  // Look up this user in your `users` table
  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user role:", error);
    redirect("/dashboard");
  }

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // ✅ User is an admin, render the admin layout
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}