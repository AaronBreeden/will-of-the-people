"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";

interface Vote {
  id: string;
  title: string;
  description?: string;
  stage1_start: string | null;
  stage1_end: string | null;
  stage2_start: string | null;
  stage2_end: string | null;
  stage3_start: string | null;
  stage3_end: string | null;
  status: string;
}

interface UserVoteStatus {
  vote_id: string;
  stage: number;
}

interface StageResults {
  choice_id: string;
  option_title: string;
  option_description: string;
  total_votes: number;
  weighted_votes: number;
}

// === UTC-SAFE DATE UTILS ===
function toDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatUtcForDisplay(iso?: string | null) {
  const d = toDate(iso);
  if (!d) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm} UTC`;
}

// === STAGE LOGIC ===
function computeActiveStage(vote: Vote): number | null {
  const now = new Date();
  const s1 = toDate(vote.stage1_start);
  const e1 = toDate(vote.stage1_end);
  const s2 = toDate(vote.stage2_start);
  const e2 = toDate(vote.stage2_end);
  const s3 = toDate(vote.stage3_start);
  const e3 = toDate(vote.stage3_end);

  // Stage 1: active if started and (no end OR not ended)
  if (s1 && (!e1 || now < e1)) {
    // If stage 2 exists, only stage 1 is active if stage 2 hasn't started
    if (s2 && now >= s2) return null;
    return 1;
  }
  
  // Stage 2: active if started and (no end OR not ended)
  if (s2 && (!e2 || now < e2)) {
    // If stage 3 exists, only stage 2 is active if stage 3 hasn't started
    if (s3 && now >= s3) return null;
    return 2;
  }
  
  // Stage 3: active if started and (no end OR not ended)
  if (s3 && (!e3 || now < e3)) {
    return 3;
  }
  
  return null;
}

function hasAnyClosedStages(vote: Vote): boolean {
  const now = new Date();
  return [
    vote.stage1_end,
    vote.stage2_end,
    vote.stage3_end,
  ].some((iso) => {
    const d = toDate(iso);
    return d ? now > d : false;
  });
}

// === MAIN COMPONENT ===
export default function DashboardPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [userVotes, setUserVotes] = useState<UserVoteStatus[]>([]);
  const [results, setResults] = useState<Record<string, StageResults[]>>({});
  const [loading, setLoading] = useState(true);
  const [userPopulations, setUserPopulations] = useState<string[]>([]);
  const [pastOpen, setPastOpen] = useState(false);
  const [topIssues, setTopIssues] = useState<Record<string, {title: string, description: string}>>({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // 1) fetch user populations
        let userPops: string[] = [];
        if (user) {
          const { data: upData, error: upErr } = await supabase
            .from("user_populations")
            .select("population_id")
            .eq("user_id", user.id);
          if (upErr) {
            console.error("Failed to load user_populations:", upErr);
          } else {
            userPops = (upData || []).map((r: any) => r.population_id);
          }
        }
        setUserPopulations(userPops);

        if (!userPops || userPops.length === 0) {
          setVotes([]);
          setUserVotes([]);
          setResults({});
          setLoading(false);
          return;
        }

        // 2) Get vote_ids from vote_populations matching user's populations
        let voteIds: string[] = [];
        const { data: votePopData, error: vpErr } = await supabase
          .from("vote_populations")
          .select("vote_id, population_id")
          .in("population_id", userPops);
        if (vpErr) {
          console.error("Error querying vote_populations:", vpErr);
        } else {
          voteIds = Array.from(new Set((votePopData || []).map((r: any) => r.vote_id)));
        }

        // 3) Fetch votes by id
        let votesData: Vote[] = [];
        if (voteIds.length > 0) {
          const { data: vData, error: vErr } = await supabase
            .from("votes")
            .select("*")
            .in("id", voteIds)
            .in("status", ["open", "closed"])
            .order("stage1_start", { ascending: false });
          if (vErr) {
            console.error("Error fetching votes by ids:", vErr);
          } else {
            votesData = vData || [];
          }
        }

        // 4) Fetch user's vote status
        let userVotesData: UserVoteStatus[] = [];
        if (user && votesData.length > 0) {
          const voteIdList = votesData.map((v) => v.id);
          const { data: uvData, error: uvErr } = await supabase
            .from("user_votes")
            .select("vote_id, stage")
            .eq("user_id", user.id)
            .in("vote_id", voteIdList);
          if (uvErr) {
            console.error("Error fetching user_votes:", uvErr);
          } else {
            userVotesData = uvData || [];
          }
        }

        // 5) Fetch results for votes
        const resultsLookup: Record<string, StageResults[]> = {};
        const topIssueLookup: Record<string, {title: string, description: string}> = {};
        if (votesData.length > 0) {
          for (const vote of votesData) {
            for (const stage of [1, 2, 3]) {
              const { data: r } = await supabase
                .from("results")
                .select("*")
                .eq("vote_id", vote.id)
                .eq("stage", stage)
                .order("tally_run", { ascending: false })
                .limit(50);
              if (r && r.length > 0) {
                const latestRun = r[0].tally_run;
                const snapshot = r.filter((row: any) => row.tally_run === latestRun);
                const optionTable = stage === 1 ? "issues" : stage === 2 ? "approaches" : "plans";
                const { data: optionInfo } = await supabase
                  .from(optionTable)
                  .select("id, title, description")
                  .in("id", snapshot.map((row: any) => row.choice_id));
                const joined = snapshot.map((row: any) => {
                  const info = optionInfo?.find((o: any) => o.id === row.choice_id);
                  return {
                    ...row,
                    option_title: info?.title || "Unknown",
                    option_description: info?.description || "No description"
                  };
                });
                resultsLookup[`${vote.id}-stage${stage}`] = joined;

                // Store top issue for stage 1
                if (stage === 1 && joined.length > 0) {
                  const top = [...joined].sort((a, b) => b.weighted_votes - a.weighted_votes)[0];
                  topIssueLookup[vote.id] = {
                    title: top.option_title,
                    description: top.option_description
                  };
                }
              }
            }
          }
        }

        setVotes(votesData);
        setUserVotes(userVotesData);
        setResults(resultsLookup);
        setTopIssues(topIssueLookup);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  function hasUserVoted(voteId: string, stage: number): boolean {
    return userVotes.some((uv) => uv.vote_id === voteId && uv.stage === stage);
  }

  if (loading) return <p className="animate-pulse p-6">Loading votes…</p>;

  const currentVotes = votes.filter((v) => v.status === "open");
  const pastVotes = votes
    .filter((v) => v.status === "closed")
    .sort((a, b) => {
      const ta = a.stage1_start ? new Date(a.stage1_start).getTime() : 0;
      const tb = b.stage1_start ? new Date(b.stage1_start).getTime() : 0;
      return tb - ta;
    });

  return (
    <div className="space-y-8 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">📊 Your Votes</h2>
          <p className="text-sm text-gray-600 mt-1">Open votes you can participate in are shown first.</p>
        </div>

        <div className="relative">
          <Card className="px-3 py-2 flex items-center gap-3">
            <div className="text-sm text-gray-700">See the results of past votes</div>
            <button
              onClick={() => setPastOpen((s) => !s)}
              className="ml-2 inline-flex items-center gap-2 px-3 py-1 rounded bg-violet-700 hover:bg-violet-800 text-white text-sm shadow"
              aria-expanded={pastOpen}
            >
              {pastOpen ? "Close" : "Open"}
            </button>
          </Card>

          {pastOpen && (
            <div className="absolute right-0 mt-3 w-[min(90vw,640px)] max-h-[70vh] overflow-auto z-40">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Past Votes — Results</h3>
                  <button
                    onClick={() => setPastOpen(false)}
                    className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>

                {pastVotes.length === 0 ? (
                  <p className="text-gray-600">No past votes available for your populations.</p>
                ) : (
                  <div className="grid gap-3">
                    {pastVotes.map((vote) => {
                      const stage1Res = results[`${vote.id}-stage1`];
                      const stage2Res = results[`${vote.id}-stage2`];
                      const stage3Res = results[`${vote.id}-stage3`];

                      let message = `Stage 1 vote: ${vote.title}`;
                      let topIssue, topApproach, topPlan;

                      if (stage1Res && stage1Res.length > 0) {
                        topIssue = [...stage1Res].sort((a, b) => b.weighted_votes - a.weighted_votes)[0];
                        message = `Top issue: ${topIssue.option_title}.`;
                      }
                      if (stage2Res && stage2Res.length > 0) {
                        topApproach = [...stage2Res].sort((a, b) => b.weighted_votes - a.weighted_votes)[0];
                        message += ` Top approach: ${topApproach.option_title}.`;
                      }
                      if (stage3Res && stage3Res.length > 0) {
                        topPlan = [...stage3Res].sort((a, b) => b.weighted_votes - a.weighted_votes)[0];
                        message += ` Winning plan: ${topPlan.option_title}.`;
                      }

                      return (
                        <div key={vote.id} className="flex items-start justify-between gap-3 p-3 border rounded">
                          <div>
                            <div className="text-sm font-semibold">{vote.title}</div>
                            <div className="text-xs text-gray-600 mt-1">{message}</div>
                          </div>
                          <div className="flex-shrink-0">
                            <Link
                              href={`/results/${vote.id}`}
                              className="inline-block bg-gradient-to-r from-purple-700 to-purple-600 text-white px-3 py-1 rounded shadow"
                            >
                              📖 View
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      <section>
        <h3 className="text-2xl font-semibold mb-4">Current Votes</h3>
        {currentVotes.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-600">No votes are currently open to you.</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentVotes.map((vote) => {
              const currentStage = computeActiveStage(vote);
              const hasVoted = currentStage ? hasUserVoted(vote.id, currentStage) : false;
              const topIssue = topIssues[vote.id];

              return (
                <Card key={vote.id}>
                  <h3 className="text-xl font-semibold mb-2">{vote.title}</h3>
                  <p className="text-sm text-gray-700 mb-3">
                    {vote.description ?? ""}
                  </p>

                  <div className="space-y-2">
                    {currentStage === 1 && (
                      <>
                        <p className="text-blue-600 font-medium">
                          Stage 1: Issues voting{vote.stage1_end ? ` open until ${formatUtcForDisplay(vote.stage1_end)}` : ' is open'}
                        </p>
                        {!hasVoted ? (
                          <Link
                            href={`/vote/${vote.id}/1`}
                            className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-xl shadow hover:shadow-md"
                          >
                            Vote Now →
                          </Link>
                        ) : (
                          <Link
                            href={`/vote/${vote.id}/1`}
                            className="inline-block bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2 rounded-xl shadow hover:shadow-md"
                          >
                            ✅ You have voted — change your vote
                          </Link>
                        )}
                      </>
                    )}

                    {currentStage === 2 && (
                      <>
                        <p className="text-blue-600 font-medium">
                          The top issue from stage 1 voting was: <strong>{topIssue?.title || "—"}</strong>
                        </p>
                        <p className="text-sm text-gray-700">
                          {topIssue?.description || "No description available"}
                        </p>
                        <p className="text-blue-600 font-medium">
                          Stage 2: Approaches voting{vote.stage2_end ? ` open until ${formatUtcForDisplay(vote.stage2_end)}` : ' is open'}
                        </p>
                        {!hasVoted ? (
                          <Link
                            href={`/vote/${vote.id}/2`}
                            className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-xl shadow hover:shadow-md"
                          >
                            Vote Now →
                          </Link>
                        ) : (
                          <Link
                            href={`/vote/${vote.id}/2`}
                            className="inline-block bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2 rounded-xl shadow hover:shadow-md"
                          >
                            ✅ You have voted — change your vote
                          </Link>
                        )}
                      </>
                    )}

                    {currentStage === 3 && (
                      <>
                        <p className="text-blue-600 font-medium">
                          Stage 3: Plans voting{vote.stage3_end ? ` open until ${formatUtcForDisplay(vote.stage3_end)}` : ' is open'}
                        </p>
                        {!hasVoted ? (
                          <Link
                            href={`/vote/${vote.id}/3`}
                            className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-xl shadow hover:shadow-md"
                          >
                            Vote Now →
                          </Link>
                        ) : (
                          <Link
                            href={`/vote/${vote.id}/3`}
                            className="inline-block bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2 rounded-xl shadow hover:shadow-md"
                          >
                            ✅ You have voted — change your vote
                          </Link>
                        )}
                      </>
                    )}

                    {!currentStage && (
                      <p className="text-gray-500 text-sm">This vote is not currently active for voting.</p>
                    )}

                    {(hasAnyClosedStages(vote) || vote.status === "open") && (
                      <Link
                        href={`/results/${vote.id}`}
                        className="inline-block bg-gradient-to-r from-purple-700 to-purple-600 text-white px-3 py-1.5 rounded-lg shadow hover:shadow-md text-xs mt-2"
                      >
                        {vote.status === "open" 
                          ? "View results of previous voting stages" 
                          : "📖 View Results"}
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}