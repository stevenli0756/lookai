import { createServiceClient } from "@/lib/supabase/server"

// Temporary connection test — delete after Phase 2a verification
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from("profiles").select("count").limit(0)

  if (error && !error.message.includes("Could not find the table")) {
    // Table not existing yet is expected before migrations — anything else is a real error
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, message: "Supabase connection successful" })
}
