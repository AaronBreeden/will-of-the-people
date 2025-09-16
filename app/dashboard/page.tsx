'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function Dashboard() {
  const [openVotes, setOpenVotes] = useState<any[]>([])
  const [closedVotes, setClosedVotes] = useState<any[]>([])

  useEffect(() => {
    async function loadVotes() {
      const { data } = await supabase.from('votes').select('*')
      if (data) {
        setOpenVotes(data.filter(v => v.status === 'open'))
        setClosedVotes(data.filter(v => v.status === 'closed'))
      }
    }
    loadVotes()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">My Account</h1>

      <h2 className="mt-6 text-xl">Open Votes</h2>
      {openVotes.map(v => (
        <Link key={v.id} href={`/vote/${v.id}/${v.stage}`}>
          <div className="p-4 border rounded my-2 hover:bg-gray-100">
            {v.title} (Stage {v.stage})
          </div>
        </Link>
      ))}

      <h2 className="mt-6 text-xl">Closed Votes</h2>
      {closedVotes.map(v => (
        <Link key={v.id} href={`/results/${v.id}`}>
          <div className="p-4 border rounded my-2 hover:bg-gray-100">
            {v.title} (Results)
          </div>
        </Link>
      ))}
    </div>
  )
}