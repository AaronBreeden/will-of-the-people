// src/app/vote/[voteId]/[stage]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

interface VoteOption {
  id: string;
  title: string;
  description: string;
}

interface BasicKnowledgeQuestion {
  id: string;
  question: string;
  options: string[]; // Assuming options are an array of strings
  correct_answer: string;
}

export default function VotePage({ params }: { params: { voteId: string, stage: string } }) {
  const router = useRouter()
  const { voteId, stage } = params
  const stageNum = parseInt(stage)

  const [vote, setVote] = useState<any>(null)
  const [options, setOptions] = useState<VoteOption[]>([])
  const [selectedOption, setSelectedOption] = useState<VoteOption | null>(null)
  const [bkqs, setBkqs] = useState<BasicKnowledgeQuestion[]>([])
  const [userAnswers, setUserAnswers] = useState<string[]>(['', '', ''])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVoteData() {
      setLoading(true)
      setError(null)
      try {
        // Fetch the main vote details
        const { data: voteData, error: voteError } = await supabase
          .from('votes')
          .select('*')
          .eq('id', voteId)
          .single()

        if (voteError) throw voteError
        setVote(voteData)

        // Determine which table to query based on the stage
        let tableName: string
        if (stageNum === 1) tableName = 'issues'
        else if (stageNum === 2) tableName = 'approaches'
        else if (stageNum === 3) tableName = 'plans'
        else throw new Error('Invalid stage number')

        // Fetch options for the current stage
        const { data: optionsData, error: optionsError } = await supabase
          .from(tableName)
          .select('*')
          .eq('vote_id', voteId)

        if (optionsError) throw optionsError
        setOptions(optionsData || [])

      } catch (err: any) {
        console.error('Error fetching vote data:', err.message)
        setError('Failed to load vote data: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVoteData()
  }, [voteId, stageNum])

  // Fetch BKQs when an option is selected
  useEffect(() => {
    async function fetchBkqs() {
      if (!selectedOption) {
        setBkqs([])
        return
      }

      let relatedType: 'issue' | 'approach' | 'plan'
      if (stageNum === 1) relatedType = 'issue'
      else if (stageNum === 2) relatedType = 'approach'
      else if (stageNum === 3) relatedType = 'plan'
      else return

      try {
        const { data, error } = await supabase
          .from('basic_knowledge_questions')
          .select('*')
          .eq('related_type', relatedType)
          .eq('related_id', selectedOption.id)
          .limit(3) // Ensure we only get up to 3 BKQs

        if (error) throw error
        setBkqs(data || [])
        setUserAnswers(['', '', '']) // Reset answers for new BKQs
      } catch (err: any) {
        console.error('Error fetching BKQs:', err.message)
        setError('Failed to load knowledge questions: ' + err.message)
      }
    }
    fetchBkqs()
  }, [selectedOption, stageNum])

  const handleOptionSelect = (option: VoteOption) => {
    setSelectedOption(option)
  }

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...userAnswers]
    newAnswers[index] = value
    setUserAnswers(newAnswers)
  }

  const handleSubmitVote = async () => {
    if (!selectedOption) {
      alert('Please select an option before voting.')
      return
    }

    // Calculate correct BKQ answers
    let correctCount = 0
    bkqs.forEach((bkq, index) => {
      if (userAnswers[index] === bkq.correct_answer) {
        correctCount++
      }
    })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to vote.')
        router.push('/') // Redirect to home/login
        return
      }

      const { error } = await supabase.from('user_votes').insert({
        user_id: user.id,
        vote_id: voteId,
        stage: stageNum,
        choice_id: selectedOption.id,
        bkq_correct_count: correctCount,
      })

      if (error) throw error
      alert('Your vote has been submitted successfully!')
      router.push('/dashboard') // Redirect to dashboard after voting
    } catch (err: any) {
      console.error('Error submitting vote:', err.message)
      alert('Failed to submit vote: ' + err.message)
    }
  }

  if (loading) return <div className="p-8">Loading vote...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>
  if (!vote) return <div className="p-8">Vote not found.</div>

  const stageTitle = stageNum === 1 ? 'Issue' : stageNum === 2 ? 'Approach' : 'Plan of Action'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Vote: {vote.title} - Stage {stageNum} ({stageTitle})</h1>
      <p className="mb-4">{vote.description}</p>

      <h2 className="text-2xl font-semibold mb-4">Select your preferred {stageTitle}:</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {options.map(option => (
          <div
            key={option.id}
            className={`p-4 border rounded cursor-pointer ${selectedOption?.id === option.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}`}
            onClick={() => handleOptionSelect(option)}
          >
            <h3 className="font-medium">{option.title}</h3>
            <p className="text-sm text-gray-600">{option.description}</p>
          </div>
        ))}
      </div>

      {selectedOption && (
        <div className="mt-8 p-6 border rounded bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Basic Knowledge Questions for "{selectedOption.title}"</h2>
          {bkqs.length > 0 ? (
            bkqs.map((bkq, index) => (
              <div key={bkq.id} className="mb-4">
                <p className="font-medium mb-2">{index + 1}. {bkq.question}</p>
                <div className="flex flex-col space-y-2">
                  {bkq.options.map((opt, optIndex) => (
                    <label key={optIndex} className="inline-flex items-center">
                      <input
                        type="radio"
                        name={`bkq-${bkq.id}`}
                        value={opt}
                        checked={userAnswers[index] === opt}
                        onChange={() => handleAnswerChange(index, opt)}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p>No basic knowledge questions found for this selection.</p>
          )}

          <button
            onClick={handleSubmitVote}
            className="mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition duration-200"
          >
            Submit Your Vote
          </button>
        </div>
      )}
    </div>
  )
}