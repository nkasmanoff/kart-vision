"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/", "layout")
  redirect("/analyzer")
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get("email") as string).toLowerCase().trim()
  const password = formData.get("password") as string

  // Check allowlist before creating the account
  const { data: allowed } = await supabase
    .from("allowed_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle()

  if (!allowed) {
    redirect("/auth/sign-up?error=not_allowed")
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/analyzer`,
    },
  })

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/", "layout")
  redirect("/auth/sign-up-success")
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}
