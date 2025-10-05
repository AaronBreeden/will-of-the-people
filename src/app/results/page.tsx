"use client";

import { useEffect, useState } from "react";
import Section from "@/components/Section";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabaseClient";

interface Vote {
  id: string;
  title: string;
  stage: number;
  status: string;
  outcome: string | null; // optional column for outcome summary
  detail?: string | null;
  end_date: string;
}

export default function ResultsPage() {
  const [results, setResults] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      const { data, error } = await supabase
        .from("votes")
        .select("id, title, stage, status, end_date, outcome, detail")
        .eq("status", "closed")
        .order("end_date", { ascending: false });

      if (!error && data) {
        setResults(data);
      }
      setLoading(false);
    }

    fetchResults();
  }, []);

  if (loading) return <p className="p-6">Loading results…</p>;

  return (
    <div>
      <Section id="results" title="📊 Voting Results" align="center">
        {results.length === 0 ? (
          <p className="text-gray-600">No closed votes yet.</p>
        ) : (
          <>
            <p className="text-gray-700 mb-10 max-w-2xl mx-auto">
              Explore the collective decisions already made by the community.  
              These results reflect majority votes at each completed stage.
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((vote) => (
                <Card key={vote.id}>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {vote.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-1">
                    Stage {vote.stage} • Closed{" "}
                    {new Date(vote.end_date).toLocaleDateString()}
                  </p>
                  {vote.outcome ? (
                    <p className="text-gray-800 font-medium mb-2">
                      {vote.outcome}
                    </p>
                  ) : (
                    <p className="text-gray-500 italic mb-2">
                      Outcome not recorded
                    </p>
                  )}
                  {vote.detail && (
                    <p className="text-gray-600 text-sm">{vote.detail}</p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}