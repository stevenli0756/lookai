import { createClient } from "@/lib/supabase/server"
import SignOutButton from "./SignOutButton"
import TryOnForm from "./components/TryOnForm"

export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", user!.id)
    .single()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-950">LookAI</p>
            <p className="text-sm text-zinc-500">{user!.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <TryOnForm initialCredits={profile?.credits_remaining ?? 0} />
      </div>
    </div>
  )
}
