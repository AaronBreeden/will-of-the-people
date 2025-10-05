'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthButton() {
  const [mode, setMode] = useState<'magic' | 'password'>('password')
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleMagicLinkLogin = async () => {
    if (!email) {
      alert("Please enter your email")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)

    if (error) {
      alert("Error: " + error.message)
    } else {
      alert("Check your email for the magic link!")
    }
  }

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      alert("Please enter both email and password")
      return
    }

    setLoading(true)
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      alert("Login failed: " + error.message)
    } else {
      console.log("Logged in user:", data.user)
      window.location.href = "/dashboard"
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Mode Toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setMode('password')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'password'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Password Login
        </button>
        <button
          onClick={() => setMode('magic')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'magic'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Magic Link
        </button>
      </div>

      {/* Email Input (always shown) */}
      <input
        type="email"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* Password Input (only for password mode) */}
      {mode === 'password' && (
        <input
          type="password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}

      {/* Login Button */}
      <button
        onClick={mode === 'password' ? handlePasswordLogin : handleMagicLinkLogin}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : mode === 'password' ? (
          'Sign In'
        ) : (
          'Send Magic Link'
        )}
      </button>

      {/* Magic Link Instructions */}
      {mode === 'magic' && (
        <p className="text-sm text-gray-600 text-center">
          We'll send you a secure link to sign in instantly
        </p>
      )}

      {/* Logout Button (you can show this conditionally if user is logged in) */}
      <button
        onClick={handleLogout}
        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Sign Out
      </button>
    </div>
  )
}