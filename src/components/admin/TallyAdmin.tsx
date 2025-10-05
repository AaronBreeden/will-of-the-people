"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";
import Button from "@/components/Button";

interface Vote {
  id: string;
  title: string;
  status: string;
  stage1_end?: string | null;
  stage2_end?: string | null;
  stage3_end?: string | null;
}

interface TallyResult {
  choice_id: string;
  name: string;
  total_votes: number;
  weighted_votes: number;
  knowledge_breakdown?: {
    bkq0?: number;
    bkq1?: number;
    bkq2?: number;
    bkq3?: number;
  };
  is_winner?: boolean;
}

export default function TallyAdmin() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedVoteId, setSelectedVoteId] = useState("");
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [results, setResults] = useState<TallyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVotes() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("votes")
          .select("id, title, status, stage1_end, stage2_end, stage3_end")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setVotes((data as Vote[]) || []);
      } catch (err: any) {
        console.error("Failed to load votes:", err);
        setErrorMsg("Failed to load votes");
      } finally {
        setLoading(false);
      }
    }

    fetchVotes();
  }, []);

  function getStageEndDateForSelected(vote: Vote | undefined, stage: number): Date | null {
    if (!vote) return null;
    const val =
      stage === 1 ? vote.stage1_end : stage === 2 ? vote.stage2_end : stage === 3 ? vote.stage3_end : null;
    if (!val) return null;
    try {
      return new Date(val);
    } catch {
      return null;
    }
  }

  async function runTally() {
    setErrorMsg(null);
    setResults([]);

    if (!selectedVoteId) {
      setErrorMsg("Please select a vote first.");
      return;
    }

    const vote = votes.find((v) => v.id === selectedVoteId);
    if (!vote) {
      setErrorMsg("Selected vote not found.");
      return;
    }

    const stageEnd = getStageEndDateForSelected(vote, selectedStage);
    if (stageEnd) {
      const now = new Date();
      if (stageEnd > now) {
        const ok = confirm(
          `Stage ${selectedStage} end date is ${stageEnd.toISOString()}. This stage has not finished yet. Do you still want to run the tally?`
        );
        if (!ok) return;
      }
    }

    setRunning(true);

    try {
      const { data, error } = await supabase.rpc("tally_stage_winner", {
        vote_uuid: selectedVoteId,
        stage_num: selectedStage,
      });

      if (error) {
        console.error("RPC error:", error);
        if (error.message?.includes("Could not find the function")) {
          setErrorMsg(
            `Error running tally: ${error.message}. Ensure the DB function tally_stage_winner exists and its parameter names/types match. The RPC parameters used here are { vote_uuid, stage_num }.`
          );
        } else {
          setErrorMsg("Error running tally: " + error.message);
        }
        return;
      }

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const mapped: TallyResult[] = (rows as any[]).map((r) => ({
        choice_id: String(r.choice_id ?? r.id ?? r.choice_uuid ?? ""),
        name: r.name ?? r.choice_name ?? r.label ?? "",
        total_votes: Number(r.total_votes ?? r.votes ?? 0),
        weighted_votes: Number(r.weighted_votes ?? r.weighted ?? 0),
        knowledge_breakdown: r.knowledge_breakdown ?? r.kb ?? undefined,
        is_winner: !!r.is_winner || !!r.winner,
      }));

      setResults(mapped);
    } catch (err: any) {
      console.error("Unexpected error running tally:", err);
      setErrorMsg("Unexpected error running tally: " + (err?.message ?? String(err)));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <p>Loading votes…</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Tally Vote Results</h3>

      {errorMsg && (
        <Card>
          <div className="text-sm text-red-700">{errorMsg}</div>
        </Card>
      )}

      <Card>
        <label className="block text-sm font-medium mb-1">Select Vote</label>
        <select
          value={selectedVoteId}
          onChange={(e) => {
            setSelectedVoteId(e.target.value);
            setResults([]);
            setErrorMsg(null);
          }}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">Choose vote</option>
          {votes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} ({v.status})
            </option>
          ))}
        </select>
      </Card>

      {selectedVoteId && (
        <Card>
          <label className="block text-sm font-medium mb-1">Select Stage</label>
          <select
            value={selectedStage}
            onChange={(e) => {
              setSelectedStage(Number(e.target.value));
              setResults([]);
            }}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value={1}>Stage 1 - Issues</option>
            <option value={2}>Stage 2 - Approaches</option>
            <option value={3}>Stage 3 - Plans</option>
          </select>

          <div className="mt-3 text-sm text-gray-600">
            {(() => {
              const vote = votes.find((v) => v.id === selectedVoteId);
              const end = getStageEndDateForSelected(vote, selectedStage);
              return end ? <div>Stage {selectedStage} end: {end.toISOString()}</div> : null;
            })()}
          </div>
        </Card>
      )}

      {selectedVoteId && (
        <div>
          <Button variant="primary" onClick={runTally} disabled={running}>
            {running ? "Running tally..." : "Run Tally"}
          </Button>
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <h4 className="font-medium mb-2 text-black">Results</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border text-black">
              <thead>
                <tr className="bg-gray-100 text-black">
                  <th className="text-left p-2 border">Name</th>
                  <th className="text-right p-2 border">Total Votes</th>
                  <th className="text-right p-2 border">Weighted Votes</th>
                  <th className="text-center p-2 border">Winner</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr 
                    key={r.choice_id} 
                    className={`${r.is_winner ? "bg-green-50" : ""} text-black`}
                  >
                    <td className="p-2 border font-medium text-black">{r.name}</td>
                    <td className="p-2 border text-right text-black">{r.total_votes}</td>
                    <td className="p-2 border text-right text-black">{r.weighted_votes}</td>
                    <td className="p-2 border text-center text-black">
                      {r.is_winner ? (
                        <span className="text-black">🏆</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}