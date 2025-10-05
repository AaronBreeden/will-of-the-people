"use client";

import { useEffect, useMemo, useState } from "react";
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

interface Issue {
  id: string;
  vote_id: string;
  title: string;
  description?: string | null;
}

interface Approach {
  id: string;
  issue_id: string;
  title: string;
  description?: string | null;
}

interface Plan {
  id: string;
  approach_id: string;
  title: string;
  description?: string | null;
}

interface BKQRecord {
  id: string;
  related_type: "issue" | "approach" | "plan";
  related_id: string;
  question: string;
  options: string[];
  correct_answer?: string;
  created_at?: string;
  updated_at?: string;
}

interface ReuseRow {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  related_type?: string;
  related_id?: string;
  vote_title: string;
  issue_title?: string;
  approach_title?: string;
  plan_title?: string;
}

export default function BKQsAdmin() {
  // Primary state
  const [votes, setVotes] = useState<Vote[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Main CRUD BKQs state (for selected target item in the main area)
  const [bkqs, setBkqs] = useState<BKQRecord[]>([]);
  const [selectedVoteId, setSelectedVoteId] = useState("");
  // keep UI stage selector for UX but we do NOT persist 'stage' to DB; it's only for labeling.
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [selectedApproachId, setSelectedApproachId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // form state
  const [bkqForm, setBkqForm] = useState({
    question: "",
    options: ["" as string, "" as string, "" as string, "" as string],
    correct_index: 0,
  });
  const [editingBkq, setEditingBkq] = useState<BKQRecord | null>(null);

  // reuse state
  const [showReuseForm, setShowReuseForm] = useState(false);
  const [reuseBKQs, setReuseBKQs] = useState<ReuseRow[]>([]);
  const [loadingReuse, setLoadingReuse] = useState(false);
  const [selectedReuseBKQs, setSelectedReuseBKQs] = useState<string[]>([]);
  const [reuseSearch, setReuseSearch] = useState("");
  const [highlightedTerms, setHighlightedTerms] = useState<string[]>([]);

  // target vote/target stage selection for reuse (vote -> stage -> target)
  const [targetVoteId, setTargetVoteId] = useState("");
  const [targetStage, setTargetStage] = useState<number | null>(null);
  const [targetIssueId, setTargetIssueId] = useState("");
  const [targetApproachId, setTargetApproachId] = useState("");
  const [targetPlanId, setTargetPlanId] = useState("");

  // duplicate confirmation
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [duplicateBKQs, setDuplicateBKQs] = useState<ReuseRow[]>([]);

  const [loading, setLoading] = useState(true);
  const nowISO = new Date().toISOString();

  // --- Utilities ---
  const stageToRelatedType = (s: number | null): "issue" | "approach" | "plan" | null => {
    if (s === 1) return "issue";
    if (s === 2) return "approach";
    if (s === 3) return "plan";
    return null;
  };

  // --- Initial load: votes ---
  useEffect(() => {
    async function fetchVotes() {
      try {
        const { data, error } = await supabase
          .from("votes")
          .select("id, title, status, stage1_end, stage2_end, stage3_end")
          .order("title", { ascending: true });
        if (error) throw error;
        setVotes((data as Vote[]) || []);
      } catch (err) {
        console.error("Error fetching votes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVotes();
  }, []);

  // --- Fetch hierarchical lists with descriptions ---
  async function fetchIssuesForVote(voteId: string) {
    try {
      const { data, error } = await supabase
        .from("issues")
        .select("id, title, description, vote_id")
        .eq("vote_id", voteId)
        .order("title", { ascending: true });
      if (error) throw error;
      setIssues(data || []);
    } catch (err) {
      console.error("Error fetching issues:", err);
      setIssues([]);
    }
  }

  async function fetchApproachesForIssue(issueId: string) {
    try {
      const { data, error } = await supabase
        .from("approaches")
        .select("id, title, description, issue_id")
        .eq("issue_id", issueId)
        .order("title", { ascending: true });
      if (error) throw error;
      setApproaches(data || []);
    } catch (err) {
      console.error("Error fetching approaches:", err);
      setApproaches([]);
    }
  }

  async function fetchPlansForApproach(approachId: string) {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("id, title, description, approach_id")
        .eq("approach_id", approachId)
        .order("title", { ascending: true });
      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
      setPlans([]);
    }
  }

  // --- MAIN CRUD: fetch BKQs for current selected related item (issue/approach/plan) ---
  useEffect(() => {
    // Determine the most specific selected related item
    if (selectedPlanId) {
      fetchBKQsForRelated("plan", selectedPlanId);
    } else if (selectedApproachId) {
      fetchBKQsForRelated("approach", selectedApproachId);
    } else if (selectedIssueId) {
      fetchBKQsForRelated("issue", selectedIssueId);
    } else {
      // No specific related item selected — empty list
      setBkqs([]);
    }
  }, [selectedIssueId, selectedApproachId, selectedPlanId]);

  async function fetchBKQsForRelated(related_type: "issue" | "approach" | "plan", related_id: string) {
    try {
      const { data, error } = await supabase
        .from("basic_knowledge_questions")
        .select("*")
        .eq("related_type", related_type)
        .eq("related_id", related_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBkqs((data as BKQRecord[]) || []);
    } catch (err) {
      console.error("Error fetching BKQs for related:", err);
      setBkqs([]);
    }
  }

  // --- Reuse: load all BKQs matching the selected targetStage (no pagination) ---
  useEffect(() => {
    if (showReuseForm && targetStage !== null) {
      fetchReuseBKQs();
    } else {
      setReuseBKQs([]);
      setSelectedReuseBKQs([]);
      setReuseSearch("");
      setHighlightedTerms([]);
    }
  }, [showReuseForm, targetStage, reuseSearch, targetVoteId]);

  async function fetchReuseBKQs() {
    setLoadingReuse(true);
    try {
      const related_type = stageToRelatedType(targetStage);
      if (!related_type) {
        setReuseBKQs([]);
        setLoadingReuse(false);
        return;
      }

      // Fetch all BKQs with the specific related_type (no pagination)
      const { data: bkqsData, error } = await supabase
        .from("basic_knowledge_questions")
        .select("id, question, options, correct_answer, related_type, related_id, created_at")
        .eq("related_type", related_type)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!bkqsData || bkqsData.length === 0) {
        setReuseBKQs([]);
        setLoadingReuse(false);
        return;
      }

      // Extract related IDs and fetch their titles to show context
      const issueIds = [...new Set(bkqsData.filter((b: any) => b.related_type === "issue").map((b: any) => b.related_id))].filter(Boolean) as string[];
      const approachIds = [...new Set(bkqsData.filter((b: any) => b.related_type === "approach").map((b: any) => b.related_id))].filter(Boolean) as string[];
      const planIds = [...new Set(bkqsData.filter((b: any) => b.related_type === "plan").map((b: any) => b.related_id))].filter(Boolean) as string[];

      const [issuesRes, approachesRes, plansRes] = await Promise.all([
        issueIds.length ? supabase.from("issues").select("id,title,vote_id").in("id", issueIds) : Promise.resolve({ data: [] }),
        approachIds.length ? supabase.from("approaches").select("id,title,issue_id").in("id", approachIds) : Promise.resolve({ data: [] }),
        planIds.length ? supabase.from("plans").select("id,title,approach_id").in("id", planIds) : Promise.resolve({ data: [] }),
      ]);

      const issuesData = (issuesRes as any).data || [];
      const approachesData = (approachesRes as any).data || [];
      const plansData = (plansRes as any).data || [];

      const issueMap: Record<string, any> = {};
      issuesData.forEach((i: any) => (issueMap[i.id] = i));
      const approachMap: Record<string, any> = {};
      approachesData.forEach((a: any) => (approachMap[a.id] = a));
      const planMap: Record<string, any> = {};
      plansData.forEach((p: any) => (planMap[p.id] = p));

      // Collect vote IDs for context
      const voteIds = [
        ...new Set([
          ...issuesData.map((i: any) => i.vote_id).filter(Boolean),
          ...approachesData.map((a: any) => {
            const issue = issueMap[a.issue_id];
            return issue ? issue.vote_id : null;
          }).filter(Boolean),
          ...plansData.map((p: any) => {
            const approach = approachMap[p.approach_id];
            const issue = approach ? issueMap[approach.issue_id] : null;
            return issue ? issue.vote_id : null;
          }).filter(Boolean),
        ]),
      ] as string[];

      const votesMap: Record<string, any> = {};
      if (voteIds.length) {
        const { data: votesData } = await supabase.from("votes").select("id,title").in("id", voteIds);
        (votesData || []).forEach((v: any) => (votesMap[v.id] = v));
      }

      // Deduplicate by question and options combination
      const uniqueBKQsMap: Record<string, ReuseRow> = {};
      const bkqsArray = (bkqsData as any[]).map((b: any) => {
        let vote_title = "Unknown vote";
        let issue_title: string | undefined = undefined;
        let approach_title: string | undefined = undefined;
        let plan_title: string | undefined = undefined;

        if (b.related_type === "issue") {
          const issue = issueMap[b.related_id];
          issue_title = issue?.title;
          vote_title = issue?.vote_id ? votesMap[issue.vote_id]?.title || "Unknown vote" : "Unknown vote";
        } else if (b.related_type === "approach") {
          const approach = approachMap[b.related_id];
          approach_title = approach?.title;
          const issue = approach ? issueMap[approach.issue_id] : null;
          issue_title = issue?.title;
          vote_title = issue?.vote_id ? votesMap[issue.vote_id]?.title || "Unknown vote" : "Unknown vote";
        } else if (b.related_type === "plan") {
          const plan = planMap[b.related_id];
          plan_title = plan?.title;
          const approach = plan ? approachMap[plan.approach_id] : null;
          approach_title = approach?.title;
          const issue = approach ? issueMap[approach.issue_id] : null;
          issue_title = issue?.title;
          vote_title = issue?.vote_id ? votesMap[issue.vote_id]?.title || "Unknown vote" : "Unknown vote";
        }

        const opts = Array.isArray(b.options) ? b.options : (b.options ? JSON.parse(b.options) : []);
        const correct_index = opts.indexOf(b.correct_answer) >= 0 ? opts.indexOf(b.correct_answer) : 0;

        return {
          id: b.id,
          question: b.question,
          options: opts,
          correct_index,
          related_type: b.related_type,
          related_id: b.related_id,
          vote_title,
          issue_title,
          approach_title,
          plan_title,
        };
      });

      // Deduplicate by question and options combination, keeping most recent
      bkqsArray.forEach((bkq) => {
        const key = `${bkq.question}||${bkq.options.join('||')}`;
        if (!uniqueBKQsMap[key] || 
            new Date(bkq.created_at || "") > new Date(uniqueBKQsMap[key].created_at || "")) {
          uniqueBKQsMap[key] = { ...bkq, created_at: bkq.created_at };
        }
      });

      const formatted = Object.values(uniqueBKQsMap);
      formatted.sort((a, b) => 
        new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      );

      setReuseBKQs(formatted);
      if (reuseSearch.trim()) {
        setHighlightedTerms(reuseSearch.trim().toLowerCase().split(/\s+/));
      } else {
        setHighlightedTerms([]);
      }
    } catch (err) {
      console.error("Error fetching reuse BKQs:", err);
      setReuseBKQs([]);
    } finally {
      setLoadingReuse(false);
    }
  }

  // --- Helpers: allowed target votes for reuse (exclude overall 'closed') ---
  const allowedTargetVotes = useMemo(() => votes.filter((v) => v.status !== "closed"), [votes]);

  // --- Fetch existing BKQs attached to a target (to show collisions) ---
  const [existingTargetBKQs, setExistingTargetBKQs] = useState<BKQRecord[]>([]);
  useEffect(() => {
    async function fetchExistingTarget() {
      setExistingTargetBKQs([]);
      if (!targetVoteId || !targetIssueId) return;

      let rt: "issue" | "approach" | "plan" = "issue";
      let rid = targetIssueId;
      if (targetPlanId) {
        rt = "plan";
        rid = targetPlanId;
      } else if (targetApproachId) {
        rt = "approach";
        rid = targetApproachId;
      }

      try {
        const { data, error } = await supabase
          .from("basic_knowledge_questions")
          .select("*")
          .eq("related_type", rt)
          .eq("related_id", rid)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setExistingTargetBKQs((data as BKQRecord[]) || []);
      } catch (err) {
        console.error("Error fetching existing target BKQs:", err);
        setExistingTargetBKQs([]);
      }
    }
    fetchExistingTarget();
  }, [targetVoteId, targetIssueId, targetApproachId, targetPlanId]);

  // --- CRUD: create/update/delete BKQs (main flow) ---
  async function saveBKQ() {
    if (!bkqForm.question.trim()) return alert("Question required");

    // Determine where to attach the BKQ (most specific)
    let related_type: "issue" | "approach" | "plan" = "issue";
    let related_id: string | null = selectedIssueId || null;
    if (selectedPlanId) {
      related_type = "plan";
      related_id = selectedPlanId;
    } else if (selectedApproachId) {
      related_type = "approach";
      related_id = selectedApproachId;
    }
    if (!related_id) return alert("Select an issue (minimum), or choose approach/plan");

    const cleanedOptions = bkqForm.options.map((o) => o.trim()).filter(Boolean);
    if (cleanedOptions.length < 2) return alert("At least 2 options required");
    const correct_answer = cleanedOptions[bkqForm.correct_index] || cleanedOptions[0];

    try {
      if (editingBkq) {
        const { data, error } = await supabase
          .from("basic_knowledge_questions")
          .update({
            question: bkqForm.question,
            options: cleanedOptions,
            correct_answer,
            related_type,
            related_id,
          })
          .eq("id", editingBkq.id)
          .select()
          .single();
        if (error) throw error;
        setBkqs((prev) => prev.map((b) => (b.id === data.id ? (data as any) : b)));
      } else {
        const payload: any = {
          question: bkqForm.question,
          options: cleanedOptions,
          correct_answer,
          related_type,
          related_id,
        };
        const { data, error } = await supabase
          .from("basic_knowledge_questions")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setBkqs((prev) => [data as any, ...prev]);
      }
      resetForm();

      // --- REFRESH BKQs list explicitly after save to fix stale list issue ---
      if (related_type && related_id) {
        const { data, error } = await supabase
          .from("basic_knowledge_questions")
          .select("*")
          .eq("related_type", related_type)
          .eq("related_id", related_id)
          .order("created_at", { ascending: false });
        if (!error && data) setBkqs(data);
      }
    } catch (err: any) {
      console.error("Error saving BKQ:", err);
      alert("Error saving BKQ: " + (err.message || err));
    }
  }

  async function deleteBKQ(id: string) {
    if (!confirm("Delete this BKQ question?")) return;
    try {
      const { error } = await supabase.from("basic_knowledge_questions").delete().eq("id", id);
      if (error) throw error;
      setBkqs((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      console.error("Error deleting BKQ:", err);
      alert("Error deleting BKQ: " + (err.message || err));
    }
  }

  // --- Reuse flow: assign selected reuseBKQs to target (no stage column) ---
  async function handleReuseBKQs() {
    if (selectedReuseBKQs.length === 0) {
      alert("Select at least one BKQ to reuse");
      return;
    }
    if (!targetVoteId) {
      alert("Select a target vote");
      return;
    }
    if (targetStage === null) {
      alert("Select a target stage");
      return;
    }
    if (!targetIssueId) {
      alert("Select a target issue (minimum) to attach BKQs to");
      return;
    }

    // Check for duplicates
    const selected = reuseBKQs.filter((r) => selectedReuseBKQs.includes(r.id));
    const duplicates = selected.filter(r =>
      existingTargetBKQs.some(b =>
        b.question === r.question &&
        JSON.stringify(b.options) === JSON.stringify(r.options)
      )
    );

    if (duplicates.length > 0) {
      setDuplicateBKQs(duplicates);
      setShowDuplicateConfirm(true);
      return;
    }

    await performReuse(selected);
  }

  async function performReuse(selected: ReuseRow[]) {
    let related_type: "issue" | "approach" | "plan" = "issue";
    let related_id = targetIssueId;
    if (targetPlanId) {
      related_type = "plan";
      related_id = targetPlanId;
    } else if (targetApproachId) {
      related_type = "approach";
      related_id = targetApproachId;
    }

    try {
      const toInsert = selected.map((r) => ({
        question: r.question,
        options: r.options,
        correct_answer: r.options[r.correct_index] || r.options[0] || "",
        related_type,
        related_id,
      }));

      console.debug("Inserting reused BKQs (no stage):", toInsert);

      const { error } = await supabase.from("basic_knowledge_questions").insert(toInsert);
      if (error) throw error;

      alert(`Reused ${toInsert.length} BKQ(s) and attached to target`);
      // refresh the main BKQs list if applicable (if target matches current selected)
      if (
        (related_type === "issue" && related_id === selectedIssueId) ||
        (related_type === "approach" && related_id === selectedApproachId) ||
        (related_type === "plan" && related_id === selectedPlanId)
      ) {
        // fetch the BKQs for the affected related item
        fetchBKQsForRelated(related_type, related_id);
      }
      setSelectedReuseBKQs([]);
      setShowReuseForm(false);
    } catch (err: any) {
      console.error("Error reusing BKQs:", err);
      alert("Error reusing BKQs: " + (err.message || err));
    } finally {
      setShowDuplicateConfirm(false);
    }
  }

  // --- Utility: reset form ---
  function resetForm() {
    setEditingBkq(null);
    setBkqForm({
      question: "",
      options: ["", "", "", ""],
      correct_index: 0,
    });
    setSelectedIssueId("");
    setSelectedApproachId("");
    setSelectedPlanId("");
  }

  // --- UI selection handlers for main flow ---
  useEffect(() => {
    if (selectedVoteId) {
      fetchIssuesForVote(selectedVoteId);
    } else {
      setIssues([]);
      setSelectedIssueId("");
    }
    setSelectedApproachId("");
    setSelectedPlanId("");
  }, [selectedVoteId]);

  useEffect(() => {
    if (selectedIssueId) fetchApproachesForIssue(selectedIssueId);
    else setApproaches([]);
    setSelectedApproachId("");
    setSelectedPlanId("");
  }, [selectedIssueId]);

  useEffect(() => {
    if (selectedApproachId) fetchPlansForApproach(selectedApproachId);
    else setPlans([]);
    setSelectedPlanId("");
  }, [selectedApproachId]);

  // reuse target hierarchical fetches (vote -> stage -> issues)
  useEffect(() => {
    if (targetVoteId) {
      fetchIssuesForVote(targetVoteId);
    } else {
      setIssues([]);
      setTargetIssueId("");
    }
    setTargetApproachId("");
    setTargetPlanId("");
  }, [targetVoteId]);

  useEffect(() => {
    if (targetIssueId) fetchApproachesForIssue(targetIssueId);
    else setApproaches([]);
    setTargetApproachId("");
    setTargetPlanId("");
  }, [targetIssueId]);

  useEffect(() => {
    if (targetApproachId) fetchPlansForApproach(targetApproachId);
    else setPlans([]);
    setTargetPlanId("");
  }, [targetApproachId]);

  // When editing a BKQ, ensure its hierarchy is expanded / selected
  async function handleStartEdit(bkq: BKQRecord) {
    setEditingBkq(bkq);
    setBkqForm({
      question: bkq.question,
      options: Array.isArray(bkq.options) ? bkq.options : (bkq.options ? bkq.options as any : ["", ""]),
      correct_index: bkq.options && Array.isArray(bkq.options) ? Math.max(0, (bkq.options as any).indexOf(bkq.correct_answer || "")) : 0,
    });

    // Expand selections to match the bkq related target
    if (bkq.related_type === "issue") {
      setSelectedIssueId(bkq.related_id || "");
      setSelectedApproachId("");
      setSelectedPlanId("");
      await fetchApproachesForIssue(bkq.related_id || "");
    } else if (bkq.related_type === "approach") {
      setSelectedApproachId(bkq.related_id || "");
      const { data: approachData } = await supabase.from("approaches").select("issue_id").eq("id", bkq.related_id).single();
      const issueId = (approachData as any)?.issue_id;
      if (issueId) {
        setSelectedIssueId(issueId);
        await fetchApproachesForIssue(issueId);
      }
      setSelectedPlanId("");
    } else if (bkq.related_type === "plan") {
      setSelectedPlanId(bkq.related_id || "");
      const { data: planData } = await supabase.from("plans").select("approach_id").eq("id", bkq.related_id).single();
      const approachId = (planData as any)?.approach_id;
      if (approachId) {
        setSelectedApproachId(approachId);
        const { data: approachData } = await supabase.from("approaches").select("issue_id").eq("id", approachId).single();
        const issueId = (approachData as any)?.issue_id;
        if (issueId) {
          setSelectedIssueId(issueId);
          await fetchApproachesForIssue(issueId);
          await fetchPlansForApproach(approachId);
        }
      }
    }
  }

  // --- Highlight search terms ---
  const highlightText = (text: string) => {
    if (!highlightedTerms.length) return text;
    const parts = text.split(new RegExp(`(${highlightedTerms.join('|')})`, 'gi'));
    return parts.map((part, index) =>
      highlightedTerms.some(term => part.toLowerCase() === term) ?
        <mark key={index} className="bg-yellow-200">{part}</mark> :
        part
    );
  };

  // --- Filtered reuse rows (client-side search across full fetched list) ---
  const filteredReuseRows = useMemo(() => {
    if (!reuseBKQs || reuseBKQs.length === 0) return [];
    const q = reuseSearch.trim().toLowerCase();
    if (!q) return reuseBKQs;
    const terms = q.split(/\s+/);
    setHighlightedTerms(terms);
    return reuseBKQs.filter((r) => {
      const hay = [
        r.question,
        ...(r.options || []),
        r.vote_title,
        r.issue_title || "",
        r.approach_title || "",
        r.plan_title || ""
      ].join(" ").toLowerCase();
      return terms.every(t => hay.includes(t));
    });
  }, [reuseBKQs, reuseSearch]);

  // --- Helper to check if the chosen target stage is closed for the chosen target vote ---
  const targetStageClosed = useMemo(() => {
    if (!targetVoteId || targetStage === null) return false;
    const v = votes.find((x) => x.id === targetVoteId);
    if (!v) return false;
    if (v.status === "closed") return true;
    if (targetStage === 1 && v.stage1_end) return v.stage1_end <= nowISO;
    if (targetStage === 2 && v.stage2_end) return v.stage2_end <= nowISO;
    if (targetStage === 3 && v.stage3_end) return v.stage3_end <= nowISO;
    return false;
  }, [votes, targetVoteId, targetStage]);

  if (loading) return <p>Loading votes…</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Manage Background Knowledge Questions</h3>
        <Button variant="secondary" onClick={() => {
          setShowReuseForm((s) => !s);
          if (!showReuseForm) {
            setTargetVoteId("");
            setTargetStage(null);
            setTargetIssueId("");
            setTargetApproachId("");
            setTargetPlanId("");
            setSelectedReuseBKQs([]);
            setReuseSearch("");
          }
        }}>
          {showReuseForm ? "Close Reuse" : "Reuse Existing BKQs"}
        </Button>
      </div>

      {/* REUSE FORM */}
      {showReuseForm && (
        <Card>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Reuse BKQs (select and assign to target)</h4>
            <p className="text-sm text-gray-600">
              Pick BKQs from other items, then choose a target Issue (required) and optional Approach/Plan to attach them to.
            </p>

            {/* Step A: Choose Target Vote FIRST */}
            <div>
              <label className="block text-sm font-medium mb-1">Target Vote</label>
              <select
                value={targetVoteId}
                onChange={(e) => {
                  setTargetVoteId(e.target.value);
                  setTargetIssueId("");
                  setTargetApproachId("");
                  setTargetPlanId("");
                  setReuseBKQs([]);
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Choose target vote</option>
                {allowedTargetVotes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.status})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Overall closed votes will not appear here.</p>
            </div>

            {/* Step B: Choose Target Stage (labels) */}
            <div>
              <label className="block text-sm font-medium mb-1">Target Stage</label>
              <select
                value={targetStage ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setTargetStage(val);
                  setReuseSearch("");
                  setSelectedReuseBKQs([]);
                }}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={!targetVoteId}
              >
                <option value="">Choose target stage</option>
                <option value={1}>Stage 1: Issues</option>
                <option value={2}>Stage 2: Approaches</option>
                <option value={3}>Stage 3: Plans</option>
              </select>
            </div>

            {targetStage !== null && targetVoteId && targetStageClosed && (
              <div className="text-sm text-red-600">
                Warning: the selected stage for this vote appears to be closed — you cannot attach BKQs to a closed stage.
              </div>
            )}

            {/* Step C: Choose target hierarchy (Issue required) */}
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Target Issue (required)</label>
                <select
                  value={targetIssueId}
                  onChange={(e) => {
                    setTargetIssueId(e.target.value);
                    setTargetApproachId("");
                    setTargetPlanId("");
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!targetVoteId}
                >
                  <option value="">Choose target issue</option>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id} title={i.description || undefined}>
                      {i.title}
                    </option>
                  ))}
                </select>
                {targetIssueId && (
                  <p className="text-xs text-gray-600 mt-1">{issues.find(i => i.id === targetIssueId)?.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Target Approach (optional)</label>
                <select
                  value={targetApproachId}
                  onChange={(e) => setTargetApproachId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!targetIssueId}
                >
                  <option value="">None / attach to issue</option>
                  {approaches.map((a) => (
                    <option key={a.id} value={a.id} title={a.description || undefined}>
                      {a.title}
                    </option>
                  ))}
                </select>
                {targetApproachId && (
                  <p className="text-xs text-gray-600 mt-1">{approaches.find(a => a.id === targetApproachId)?.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Target Plan (optional)</label>
                <select
                  value={targetPlanId}
                  onChange={(e) => setTargetPlanId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!targetApproachId}
                >
                  <option value="">None / attach to approach</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id} title={p.description || undefined}>
                      {p.title}
                    </option>
                  ))}
                </select>
                {targetPlanId && (
                  <p className="text-xs text-gray-600 mt-1">{plans.find(p => p.id === targetPlanId)?.description}</p>
                )}
              </div>
            </div>

            {/* Existing BKQs on target */}
            <div>
              <label className="block text-sm font-medium mb-1">Existing BKQs on target</label>
              <div className="max-h-40 overflow-y-auto border rounded p-2">
                {!targetIssueId ? (
                  <p className="text-xs text-gray-500">Select a target issue to view BKQs already attached.</p>
                ) : existingTargetBKQs.length === 0 ? (
                  <p className="text-xs text-gray-500">No BKQs currently attached to this target.</p>
                ) : (
                  existingTargetBKQs.map((b) => (
                    <div key={b.id} className="text-sm py-1 border-b last:border-b-0">
                      <div className="font-medium text-black">{b.question}</div>
                      <div className="text-xs text-black">
                        Options: {(b.options || []).join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Source BKQs list & search — no pagination, limited to related_type */}
            <div>
              <label className="block text-sm font-medium mb-1">Search BKQs to reuse</label>
              <input
                type="text"
                value={reuseSearch}
                onChange={(e) => setReuseSearch(e.target.value)}
                placeholder="Keyword search question/options/vote/issue/approach/plan"
                className="w-full px-3 py-2 border rounded-lg mb-2"
                disabled={targetStage === null}
              />

              <div className="max-h-96 overflow-y-auto border rounded p-3 space-y-2 mb-3">
                {loadingReuse ? (
                  <p className="text-sm text-gray-600">Loading BKQs…</p>
                ) : targetStage === null ? (
                  <p className="text-sm text-gray-500">Choose a target stage to load matching BKQs.</p>
                ) : filteredReuseRows.length === 0 ? (
                  <p className="text-sm text-gray-500">No BKQs found.</p>
                ) : (
                  filteredReuseRows.map((r) => (
                    <label key={r.id} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedReuseBKQs.includes(r.id)}
                        onChange={() =>
                          setSelectedReuseBKQs((prev) => (prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]))
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{highlightText(r.question)}</div>
                        <div className="text-xs text-gray-600">
                          {r.options.map((opt, idx) => (
                            <span key={idx} className={idx === r.correct_index ? "font-semibold text-green-700" : ""}>
                              {highlightText(opt)}{idx < r.options.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {highlightText(r.vote_title)} {r.issue_title ? `→ ${highlightText(r.issue_title)}` : ""} {r.approach_title ? `→ ${highlightText(r.approach_title)}` : ""} {r.plan_title ? `→ ${highlightText(r.plan_title)}` : ""}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleReuseBKQs}
                disabled={
                  selectedReuseBKQs.length === 0 ||
                  !targetVoteId ||
                  targetStage === null ||
                  !targetIssueId ||
                  targetStageClosed
                }
              >
                Reuse Selected BKQs into Target
              </Button>
              <Button variant="secondary" onClick={() => setShowReuseForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* DUPLICATE CONFIRMATION MODAL */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Duplicate BKQs Detected</h3>
            <p className="mb-4">
              The following BKQs already exist on the target. Do you want to proceed with reusing them?
            </p>
            <div className="space-y-3 mb-6">
              {duplicateBKQs.map((bkq) => (
                <div key={bkq.id} className="border-l-4 border-yellow-500 pl-3 py-2">
                  <div className="font-medium">{bkq.question}</div>
                  <div className="text-sm text-gray-600">
                    {bkq.options.map((opt, idx) => (
                      <span key={idx} className={idx === bkq.correct_index ? "font-semibold text-green-700" : ""}>
                        {opt}{idx < bkq.options.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowDuplicateConfirm(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => performReuse(reuseBKQs.filter(r => selectedReuseBKQs.includes(r.id)))}>Reuse Anyway</Button>
            </div>
          </Card>
        </div>
      )}

      {/* MAIN CRUD: select vote + stage + hierarchy for creating new BKQs */}
      <Card>
        <label className="block text-sm font-medium mb-1">Select Vote</label>
        <select
          value={selectedVoteId}
          onChange={(e) => {
            setSelectedVoteId(e.target.value);
            setBkqs([]);
            setSelectedIssueId("");
            setSelectedApproachId("");
            setSelectedPlanId("");
          }}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">Choose vote</option>
          {votes
            .filter(v => v.status !== "closed")
            .map((v) => (
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
            onChange={(e) => setSelectedStage(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value={1}>Stage 1: Issues</option>
            <option value={2}>Stage 2: Approaches</option>
            <option value={3}>Stage 3: Plans</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Note: BKQs are attached by related_type (issue/approach/plan); stage is a UI label here.</p>
        </Card>
      )}

      {selectedVoteId && (
        <>
          <Card>
            <label className="block text-sm font-medium mb-1">Select Issue</label>
            <select
              value={selectedIssueId}
              onChange={(e) => {
                setSelectedIssueId(e.target.value);
                setSelectedApproachId("");
                setSelectedPlanId("");
              }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Choose issue</option>
              {issues.map((i) => (
                <option key={i.id} value={i.id} title={i.description || undefined}>
                  {i.title}
                </option>
              ))}
            </select>
            {selectedIssueId && (
              <p className="text-xs text-gray-600 mt-1">{issues.find(i => i.id === selectedIssueId)?.description}</p>
            )}
          </Card>

          {selectedIssueId && (
            <Card>
              <label className="block text-sm font-medium mb-1">Select Approach (optional)</label>
              <select
                value={selectedApproachId}
                onChange={(e) => {
                  setSelectedApproachId(e.target.value);
                  setSelectedPlanId("");
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">None / attach to issue</option>
                {approaches.map((a) => (
                  <option key={a.id} value={a.id} title={a.description || undefined}>
                    {a.title}
                  </option>
                ))}
              </select>
              {selectedApproachId && (
                <p className="text-xs text-gray-600 mt-1">{approaches.find(a => a.id === selectedApproachId)?.description}</p>
              )}
            </Card>
          )}

          {selectedApproachId && (
            <Card>
              <label className="block text-sm font-medium mb-1">Select Plan (optional)</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">None / attach to approach</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id} title={p.description || undefined}>
                    {p.title}
                  </option>
                ))}
              </select>
              {selectedPlanId && (
                <p className="text-xs text-gray-600 mt-1">{plans.find(p => p.id === selectedPlanId)?.description}</p>
              )}
            </Card>
          )}
        </>
      )}

      {/* Create/Edit BKQ form */}
      {selectedVoteId && (
        <>
          <Card>
            <h4 className="font-medium mb-2">{editingBkq ? "Edit BKQ" : "Create New BKQ"}</h4>

            <input
              type="text"
              value={bkqForm.question}
              onChange={(e) => setBkqForm({ ...bkqForm, question: e.target.value })}
              placeholder="Question"
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />

            <div className="space-y-2">
              {bkqForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_index"
                    checked={bkqForm.correct_index === idx}
                    onChange={() => setBkqForm({ ...bkqForm, correct_index: idx })}
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...bkqForm.options];
                      newOpts[idx] = e.target.value;
                      setBkqForm({ ...bkqForm, options: newOpts });
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBkqForm((prev) => ({ ...prev, options: [...prev.options, ""] }))}
              >
                + Add Option
              </Button>
              {bkqForm.options.length > 2 && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setBkqForm((prev) => ({ ...prev, options: prev.options.slice(0, -1) }))}
                >
                  - Remove Option
                </Button>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="primary" onClick={saveBKQ}>
                {editingBkq ? "Update" : "Create"}
              </Button>
              {editingBkq && <Button variant="secondary" onClick={() => resetForm()}>Cancel</Button>}
            </div>
          </Card>

          {/* BKQs list for selected related item */}
          <div className="grid gap-4">
            {bkqs.length === 0 ? (
              <Card>
                <p className="text-gray-500 italic">No BKQs yet for this item.</p>
              </Card>
            ) : (
              bkqs.map((b) => (
                <Card key={b.id}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <h5 className="font-semibold">{b.question}</h5>
                      <div className="text-sm text-gray-700 mt-1">
                        {(b.options || []).map((o, idx) => (
                          <div key={idx} className={o === b.correct_answer ? "font-semibold text-blue-700" : ""}>
                            - {o}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleStartEdit(b)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteBKQ(b.id)}>Delete</Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}