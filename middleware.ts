import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  return await updateSession(req);
}