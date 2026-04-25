import { createClient } from "@/lib/supabase/server"
import SignOutButton from "./SignOutButton"

export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", user!.id)
    .single()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">{user!.email}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-600">
            Credits remaining:{" "}
            <span className="font-semibold text-gray-900">
              {profile?.credits_remaining ?? "—"}
            </span>
          </p>
        </div>
        <button
          disabled
          className="w-full py-2 px-4 bg-black text-white text-sm font-medium rounded-lg opacity-40 cursor-not-allowed"
        >
          Generate try-on
        </button>
        <div className="text-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
