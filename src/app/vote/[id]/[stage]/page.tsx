"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

interface Option {
  id: string;
  title: string;
  description: string;
  weighted_votes?: number;
  total_votes?: number;
}

interface KnowledgeQuestionRaw {
  id: string;
  question: string;
  correct_answer: any;
  options: any;
  related_id: string;
}

interface KnowledgeQuestion {
  id: string;
  question: string;
  correctRaw: any;
  options: string[];
  related_id: string;
}

interface UserVote {
  issue_id?: string;
  approach_id?: string;
  plan_id?: string;
}

function formatDateRange(start: string, end: string) {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    };
    return `${s.toLocaleString([], formatOptions)} — ${e.toLocaleString([], formatOptions)}`;
  } catch {
    return `${start} — ${end}`;
  }
}

function normalizeOptions(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((r) => String(r));
  if (typeof raw === "string") {
    const txt = raw.trim();
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) return parsed.map((p) => String(p));
      return [String(parsed)];
    } catch {
      if (txt.includes(",")) return txt.split(",").map((s) => s.trim());
      return [txt];
    }
  }
  return [String(raw)];
}

function isAnswerCorrect(question: KnowledgeQuestion, selectedValue?: string | null): boolean {
  if (!selectedValue) return false;
  const sel = String(selectedValue).trim();

  const c = question.correctRaw;
  if (c === null || typeof c === "undefined") return false;

  if (Array.isArray(c)) {
    return c.map(String).map((s) => s.trim().toLowerCase()).includes(sel.toLowerCase());
  }

  if (typeof c === "number") {
    const idx = c;
    if (question.options && question.options.length > idx) {
      return String(question.options[idx]).trim().toLowerCase() === sel.toLowerCase();
    }
    return String(c).trim().toLowerCase() === sel.toLowerCase();
  }

  if (typeof c === "string") {
    const txt = c.trim();

    if ((txt.startsWith("[") && txt.endsWith("]")) || (txt.startsWith('"') && txt.endsWith('"'))) {
      try {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((s) => s.trim().toLowerCase()).includes(sel.toLowerCase());
        }
      } catch {}
    }

    if (/^\d+$/.test(txt)) {
      const idx = Number(txt);
      if (question.options && question.options.length > idx) {
        return String(question.options[idx]).trim().toLowerCase() === sel.toLowerCase();
      }
    }

    if (txt.toLowerCase() === sel.toLowerCase()) return true;

    if (question.options && question.options.length > 0) {
      return question.options.map((o) => o.trim().toLowerCase()).includes(sel.toLowerCase());
    }

    return false;
  }

  try {
    return String(c).trim().toLowerCase() === sel.toLowerCase();
  } catch {
    return false;
  }
}

export default function VotePage({
  params,
}: {
  params: Promise<{ id: string; stage: string }>;
}) {
  const { id: voteId, stage: stageStr } = use(params);
  const stage = parseInt(stageStr, 10);

  const router = useRouter();

  const [vote, setVote] = useState<Vote | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [questions, setQuestions] = useState<KnowledgeQuestion[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [existingVote, setExistingVote] = useState<UserVote | null>(null);
  const [winningIssue, setWinningIssue] = useState<any>(null);
  const [showCheers, setShowCheers] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { data: voteData, error: voteError } = await supabase
          .from("votes")
          .select("*")
          .eq("id", voteId)
          .single();

        if (voteError) throw voteError;
        if (!isMounted) return;
        setVote(voteData);

        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user ?? null;
        if (user) {
          const { data: existingVoteData } = await supabase
            .from("user_votes")
            .select("issue_id, approach_id, plan_id")
            .eq("user_id", user.id)
            .eq("vote_id", voteId)
            .eq("stage", stage)
            .single();

          if (existingVoteData) {
            setExistingVote(existingVoteData);
            const existingChoice =
              stage === 1 ? existingVoteData.issue_id : stage === 2 ? existingVoteData.approach_id : existingVoteData.plan_id;
            if (existingChoice) setSelectedOption(existingChoice);
          }
        }

        let winningIssueId: string | null = null;
        if (stage >= 2) {
          const { data: winningIssueData, error: winningIssueError } = await supabase
            .from("issues")
            .select("*")
            .eq("vote_id", voteId)
            .eq("is_winner", true)
            .single();

          if (winningIssueError) throw winningIssueError;
          setWinningIssue(winningIssueData);
          winningIssueId = winningIssueData?.id ?? null;
        }

        let winningApproachId: string | null = null;
        if (stage === 3) {
          const { data: winningApproachData, error: winningApproachError } = await supabase
            .from("approaches")
            .select("*")
            .eq("vote_id", voteId)
            .eq("issue_id", winningIssueId)
            .eq("is_winner", true)
            .single();

          if (winningApproachError) throw winningApproachError;
          winningApproachId = winningApproachData?.id ?? null;
        }

        let optionsData: any[] = [];
        if (stage === 1) {
          const { data, error } = await supabase
            .from("issues_with_votes")
            .select("*")
            .eq("vote_id", voteId)
            .order("weighted_votes", { ascending: false });
          if (error) throw error;
          optionsData = data || [];
        } else if (stage === 2) {
          const { data, error } = await supabase
            .from("approaches_with_votes")
            .select("*")
            .eq("vote_id", voteId)
            .eq("issue_id", winningIssueId)
            .order("weighted_votes", { ascending: false });
          if (error) throw error;
          optionsData = data || [];
        } else {
          const { data, error } = await supabase
            .from("plans_with_votes")
            .select("*")
            .eq("vote_id", voteId)
            .eq("approach_id", winningApproachId)
            .order("weighted_votes", { ascending: false });
          if (error) throw error;
          optionsData = data || [];
        }

        if (!isMounted) return;
        setOptions(optionsData);

        const relatedType = stage === 1 ? "issue" : stage === 2 ? "approach" : "plan";
        const optionIds = optionsData.map((o) => o.id).filter(Boolean);
        let questionsDataRaw: KnowledgeQuestionRaw[] = [];
        if (optionIds.length > 0) {
          const { data: qData, error: qErr } = await supabase
            .from("basic_knowledge_questions")
            .select("*")
            .eq("related_type", relatedType)
            .in("related_id", optionIds);

          if (qErr) throw qErr;
          questionsDataRaw = qData || [];
        }

        if (!isMounted) return;
        const normalized: KnowledgeQuestion[] = (questionsDataRaw || []).map((q) => ({
          id: q.id,
          question: q.question ?? "Question",
          correctRaw: q.correct_answer,
          options: normalizeOptions(q.options),
          related_id: q.related_id,
        }));

        setQuestions(normalized);
      } catch (err: any) {
        console.error("Error loading vote page data:", err);
        if (isMounted) setError(err?.message ?? "Failed to load vote");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [voteId, stage]);

  const handleSubmit = async () => {
    setError("");
    if (!selectedOption) {
      setError("Please select an option");
      return;
    }

    const relatedQuestions = questions.filter((q) => q.related_id === selectedOption);

    for (const question of relatedQuestions) {
      if (!answers[question.id]) {
        setError("Please answer all knowledge questions for your selected option");
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      let correctCount = 0;
      for (const q of relatedQuestions) {
        if (isAnswerCorrect(q, answers[q.id])) correctCount += 1;
      }

      const totalQuestions = relatedQuestions.length;
      const knowledgeWeight = totalQuestions > 0 ? correctCount / totalQuestions : 0;

      const s = Number(stage);
      const payload: any = {
        user_id: user.id,
        vote_id: voteId,
        stage: s,
        knowledge_score: correctCount,
      };

      if (s === 1) {
        payload.issue_id = selectedOption;
        payload.approach_id = null;
        payload.plan_id = null;
      } else if (s === 2) {
        payload.issue_id = null;
        payload.approach_id = selectedOption;
        payload.plan_id = null;
      } else {
        payload.issue_id = null;
        payload.approach_id = null;
        payload.plan_id = selectedOption;
      }

      const { error: upsertError } = await supabase
        .from("user_votes")
        .upsert(payload, { onConflict: "user_id,vote_id,stage" });

      if (upsertError) throw upsertError;

      // Show cheers message instead of immediate navigation
      setShowCheers(true);
    } catch (err: any) {
      console.error("Submit error:", err);
      setError(err?.message ?? "Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="animate-pulse p-6">Loading vote...</p>;
  if (error && !vote) return <p className="text-red-600 p-6">Error: {error}</p>;

  const stageTitle = stage === 1 ? "Issues" : stage === 2 ? "Approaches" : "Plans";
  const stageStart = vote
    ? stage === 1
      ? vote.stage1_start
      : stage === 2
      ? vote.stage2_start
      : vote.stage3_start
    : "";
  const stageEnd = vote
    ? stage === 1
      ? vote.stage1_end
      : stage === 2
      ? vote.stage2_end
      : vote.stage3_end
    : "";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="sticky top-0 bg-white z-20 border-b pb-3 mb-3">
        <h1 className="text-3xl font-bold mb-2">{vote?.title}</h1>
        <p className="text-gray-700 mb-2">
          {stage === 1
            ? vote?.description
            : stage === 2 && winningIssue
            ? `Now that "${winningIssue.title}" is selected, choose the best approach.`
            : "Choose the best option for this stage."}
        </p>
        <p className="text-sm font-medium text-gray-800">
          Stage {stage}: vote open from {formatDateRange(stageStart, stageEnd)}
        </p>
        {existingVote && (
          <p className="text-xs text-blue-600 mt-2">✅ You have already voted in this stage. You can change your vote.</p>
        )}
      </div>

      {showCheers ? (
        <Card>
          <div className="text-center py-8 text-green-700 text-xl font-semibold">
            🎉 Thank you for making your voice heard!
          </div>
          <div className="text-center">
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-4 max-h-[60vh] overflow-auto pr-2">
            {options.map((option, index) => {
              const relatedQuestions = questions.filter((q) => q.related_id === option.id);

              return (
                <Card key={option.id}>
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      id={option.id}
                      name="option"
                      value={option.id}
                      checked={selectedOption === option.id}
                      onChange={(e) => {
                        setSelectedOption(e.target.value);
                        setAnswers({});
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor={option.id} className="cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                          <h3 className="text-lg font-semibold">{option.title}</h3>
                          {option.weighted_votes !== undefined && option.weighted_votes > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              Score: {option.weighted_votes.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mt-1">{option.description}</p>
                        {option.total_votes !== undefined && option.total_votes > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {option.total_votes} vote{option.total_votes !== 1 ? "s" : ""} • Weighted score:{" "}
                            {option.weighted_votes?.toFixed(1) ?? "0.0"}
                          </p>
                        )}
                      </label>

                      {selectedOption === option.id && relatedQuestions.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium mb-3">
                            Basic knowledge questions ({relatedQuestions.length}): please answer all (3) questions below and then click “submit vote”
                          </h4>

                          {relatedQuestions.map((question) => (
                            <div key={question.id} className="mb-4">
                              <p className="mb-2 font-medium">{question.question}</p>
                              <div className="space-y-1">
                                {question.options && question.options.length > 0 ? (
                                  question.options.map((opt, idx) => (
                                    <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`question-${question.id}`}
                                        value={opt}
                                        checked={answers[question.id] === opt}
                                        onChange={(e) =>
                                          setAnswers((prev) => ({
                                            ...prev,
                                            [question.id]: e.target.value,
                                          }))
                                        }
                                      />
                                      <span className="text-sm">{opt}</span>
                                    </label>
                                  ))
                                ) : (
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded"
                                    value={answers[question.id] ?? ""}
                                    onChange={(e) =>
                                      setAnswers((prev) => ({
                                        ...prev,
                                        [question.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Your answer"
                                  />
                                )}
                              </div>

                              {/* Removed correctness display */}
                            </div>
                          ))}

                          <div className="text-xs text-gray-600 mt-3 p-2 bg-blue-50 rounded">
                            💡 <strong>Knowledge weighting:</strong> Correct answers increase your vote's influence.
                            Getting all questions correct gives full weight. The final stored knowledge_score is the integer
                            number of correctly answered questions for the selected option.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {options.length === 0 && !loading && (
            <Card>
              <div className="text-center py-8">
                <p className="text-gray-600">
                  No options available for this stage yet. {stage > 1 && " The previous stage may still be in progress."}
                </p>
              </div>
            </Card>
          )}

          {error && <p className="text-red-600 text-center mt-4">{error}</p>}

          <div className="text-center mt-6">
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedOption}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
            >
              {submitting ? "Submitting..." : existingVote ? "Update Vote" : "Submit Vote"}
            </button>

            {selectedOption && (
              <p className="text-xs text-gray-600 mt-2">
                Your vote will be weighted based on your knowledge question performance — knowledge_score = number of
                correct BKQs for the selected option
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}