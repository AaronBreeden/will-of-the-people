import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">The Will of The People</h1>
      <section className="mt-4">
        <h2>Our Mission</h2>
        <p>Transparent, informed, and democratic decision-making.</p>
      </section>
      <section className="mt-4">
        <Link href="/dashboard" className="bg-blue-500 text-white px-4 py-2 rounded">
          Go to Dashboard
        </Link>
      </section>
    </main>
  )
}