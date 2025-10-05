"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";

interface Vote {
  id: string;
  title: string;
  description: string;
  stage1_start: string;
  stage1_end: string;
  stage2_start: string;
  stage2_end: string;
  stage3_start: string;
  stage3_end: string;
}

interface StageResults {
  choice_id: string;
  option_title: string;
  total_votes: number;
  bkq0_count: number;
  bkq1_count: number;
  bkq2_count: number;
  bkq3_count: number;
  weighted_votes: number;
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const voteId = params.id;
  const [vote, setVote] = useState<Vote | null>(null);
  const [resultsByStage, setResultsByStage] = useState<
    Record<number, StageResults[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch Vote
      const { data: voteData } = await supabase
        .from("votes")
        .select("*")
        .eq("id", voteId)
        .single();
      setVote(voteData);

      const stageData: Record<number, StageResults[]> = {};

      for (const stage of [1, 2, 3]) {
        const { data: r } = await supabase
          .from("results")
          .select("*")
          .eq("vote_id", voteId)
          .eq("stage", stage)
          .order("tally_run", { ascending: false })
          .limit(50);

        if (r && r.length > 0) {
          const latestRun = r[0].tally_run;
          const snapshot = r.filter((row) => row.tally_run === latestRun);

          const optionTable =
            stage === 1 ? "issues" : stage === 2 ? "approaches" : "plans";

          // Join with titles
          const { data: optionTitles } = await supabase
            .from(optionTable)
            .select("id, title")
            .in("id", snapshot.map((row) => row.choice_id));

          const joined = snapshot.map((row) => ({
            ...row,
            option_title:
              optionTitles?.find((o) => o.id === row.choice_id)?.title ||
              "Unknown",
          }));

          stageData[stage] = joined;
        }
      }

      setResultsByStage(stageData);
      setLoading(false);
    }
    fetchData();
  }, [voteId]);

  function isStageOpen(vote: Vote, stage: number): boolean {
    const now = new Date();
    if (stage === 1) {
      return now >= new Date(vote.stage1_start) && now <= new Date(vote.stage1_end);
    } else if (stage === 2) {
      return now >= new Date(vote.stage2_start) && now <= new Date(vote.stage2_end);
    } else if (stage === 3) {
      return now >= new Date(vote.stage3_start) && now <= new Date(vote.stage3_end);
    }
    return false;
  }

  if (loading) return <p className="p-6 animate-pulse">Loading results…</p>;

  if (!vote) return <p className="p-6 text-red-600">Vote not found.</p>;

  // Compute top winners
  const topIssue = resultsByStage[1]?.sort(
    (a, b) => b.weighted_votes - a.weighted_votes
  )[0];
  const topApproach = resultsByStage[2]?.sort(
    (a, b) => b.weighted_votes - a.weighted_votes
  )[0];
  const topPlan = resultsByStage[3]?.sort(
    (a, b) => b.weighted_votes - a.weighted_votes
  )[0];

  const summaryLine = `
    Stage 1 vote: ${vote.title}. 
    ${topIssue ? `The top issue selected was: ${topIssue.option_title}.` : ""}
    ${topApproach ? ` Stage 2: What type of approach should we take to address "${topIssue?.option_title}"?
    The top approach selected was: ${topApproach.option_title}.` : ""}
    ${topPlan ? ` Stage 3: Which specific plan should we take to implement "${topApproach?.option_title}"?
    The winning plan was: ${topPlan.option_title}.` : ""}
  `;

  return (
    <div className="max-w-5xl mx-auto space-y-10 p-6">
      <h1 className="text-3xl font-bold">{vote.title} Results</h1>

      <Card>
        <p className="text-gray-700 whitespace-pre-line">{summaryLine}</p>
      </Card>

      {[1, 2, 3].map((stage) => {
        // Only show results for closed stages
        if (isStageOpen(vote, stage)) {
          return (
            <div key={stage} className="space-y-3">
              <h2 className="text-2xl font-semibold">
                Stage {stage}:{" "}
                {stage === 1
                  ? "Issues"
                  : stage === 2
                  ? "Approaches"
                  : "Plans"}
              </h2>
              <Card>
                <p className="text-gray-600 italic">
                  🔒 This stage is currently open for voting. Results will be available after voting closes.
                </p>
              </Card>
            </div>
          );
        }

        return resultsByStage[stage] ? (
          <div key={stage} className="space-y-3">
            <h2 className="text-2xl font-semibold">
              Stage {stage}:{" "}
              {stage === 1
                ? "Issues"
                : stage === 2
                ? "Approaches"
                : "Plans"}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 rounded-lg bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border">Option</th>
                    <th className="px-4 py-2 border">Raw Votes</th>
                    <th className="px-4 py-2 border">Knowledge 0</th>
                    <th className="px-4 py-2 border">Knowledge 1</th>
                    <th className="px-4 py-2 border">Knowledge 2</th>
                    <th className="px-4 py-2 border">Knowledge 3</th>
                    <th className="px-4 py-2 border">Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsByStage[stage].map((row) => {
                    const isWinner =
                      row.choice_id ===
                      (stage === 1
                        ? topIssue?.choice_id
                        : stage === 2
                        ? topApproach?.choice_id
                        : topPlan?.choice_id);

                    return (
                      <tr
                        key={row.choice_id}
                        className={isWinner ? "bg-green-50 font-semibold" : ""}
                      >
                        <td className="px-4 py-2 border">
                          {row.option_title}
                          {isWinner && " 🏆"}
                        </td>
                        <td className="px-4 py-2 border">{row.total_votes}</td>
                        <td className="px-4 py-2 border">{row.bkq0_count}</td>
                        <td className="px-4 py-2 border">{row.bkq1_count}</td>
                        <td className="px-4 py-2 border">{row.bkq2_count}</td>
                        <td className="px-4 py-2 border">{row.bkq3_count}</td>
                        <td className="px-4 py-2 border">
                          {row.weighted_votes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null;
      })}
    </div>
  );
}