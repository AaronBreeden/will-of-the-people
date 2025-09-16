'use client'
import { supabase } from '@/lib/supabaseClient'

export default function AuthButton() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email: prompt("Enter your email") || ""
    })
    if (error) alert(error.message)
    else alert("Check your email for the magic link!")
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div>
      <button onClick={handleLogin} className="bg-green-500 px-4 py-2 rounded text-white mr-4">
        Sign In
      </button>
      <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded text-white">
        Sign Out
      </button>
    </div>
  )
}