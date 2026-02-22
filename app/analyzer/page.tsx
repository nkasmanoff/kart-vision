import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MarioKartAnalyzer from "@/components/mario-kart-analyzer"

export default async function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>
}) {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase not configured - allow access for local dev
  }

  // If Supabase is configured but no user, redirect to login
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !user
  ) {
    redirect("/auth/login")
  }

  const params = await searchParams
  const sessionId = params?.session ?? null

  return (
    <MarioKartAnalyzer userEmail={user?.email} initialSessionId={sessionId} />
  )
}
