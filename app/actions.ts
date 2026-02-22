"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function deleteSessionAction(formData: FormData) {
  const sessionId = formData.get("sessionId") as string
  if (!sessionId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("analysis_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id)

  const { data: files } = await supabase.storage
    .from("frame-images")
    .list(`${user.id}/${sessionId}`)

  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${sessionId}/${f.name}`)
    await supabase.storage.from("frame-images").remove(paths)
  }

  revalidatePath("/")
}
