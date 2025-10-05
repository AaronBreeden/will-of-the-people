import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date().toISOString()
    console.log(`🔄 Auto-tally check at ${now}`)

    // Find votes with stages that just ended (within last 5 minutes)
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('id, title, stage1_end, stage2_end, stage3_end')
      .eq('status', 'open')

    if (votesError) throw votesError

    const results = []

    for (const vote of votes || []) {
      const stage1End = new Date(vote.stage1_end)
      const stage2End = new Date(vote.stage2_end)
      const stage3End = new Date(vote.stage3_end)
      const nowDate = new Date(now)
      const fiveMinutesAgo = new Date(nowDate.getTime() - 5 * 60 * 1000)

      // Check if any stage ended in the last 5 minutes
      let stageToTally = null
      
      if (stage1End > fiveMinutesAgo && stage1End <= nowDate) {
        stageToTally = 1
      } else if (stage2End > fiveMinutesAgo && stage2End <= nowDate) {
        stageToTally = 2
      } else if (stage3End > fiveMinutesAgo && stage3End <= nowDate) {
        stageToTally = 3
      }

      if (stageToTally) {
        console.log(`📊 Tallying Stage ${stageToTally} for vote: ${vote.title}`)
        
        // Call the tally function
        const { data: tallyResult, error: tallyError } = await supabase
          .rpc('tally_stage_winner', {
            vote_uuid: vote.id,
            stage_num: stageToTally
          })

        if (tallyError) {
          console.error(`❌ Tally error for vote ${vote.id}:`, tallyError)
          results.push({
            vote_id: vote.id,
            stage: stageToTally,
            success: false,
            error: tallyError.message
          })
        } else {
          console.log(`✅ Tally success for vote ${vote.id}:`, tallyResult)
          results.push({
            vote_id: vote.id,
            stage: stageToTally,
            success: true,
            result: tallyResult
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now,
        processed: results.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Auto-tally error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})