"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";
import Button from "@/components/Button";

// Types (vote_id fields are optional in case older rows don't have them)
interface Vote {
  id: string;
  title: string;
  status: string;
  stage3_end?: string | null;
}

interface Issue {
  id: string;
  vote_id: string;
  title: string;
}

interface Approach {
  id: string;
  issue_id: string;
  title: string;
}

interface Plan {
  id: string;
  approach_id: string | null;
  vote_id?: string | null;
  title: string;
  description?: string | null;
  order_index?: number | null;
  weighted_votes?: number | null;
  total_votes?: number | null;
  vote_title?: string;
  issue_title?: string;
  approach_title?: string;
}

interface ReusePlan {
  id: string;
  title: string;
  description?: string | null;
  approach_id?: string | null;
  approach_title?: string;
  issue_title?: string;
  vote_title?: string;
  created_at?: string;
}

export default function PlansAdmin() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [selectedVoteId, setSelectedVoteId] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [selectedApproachId, setSelectedApproachId] = useState("");

  const [loading, setLoading] = useState(true);
  const [planForm, setPlanForm] = useState({
    title: "",
    description: "",
    order_index: 1,
  });
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Reuse state
  const [showReuseForm, setShowReuseForm] = useState(false);
  const [reusePlans, setReusePlans] = useState<ReusePlan[]>([]);
  const [loadingReuse, setLoadingReuse] = useState(false);
  const [selectedReusePlans, setSelectedReusePlans] = useState<string[]>([]);
  const [targetVoteId, setTargetVoteId] = useState("");
  const [targetIssueId, setTargetIssueId] = useState("");
  const [targetApproachId, setTargetApproachId] = useState("");
  const [issuesForReuse, setIssuesForReuse] = useState<Issue[]>([]);
  const [approachesForReuse, setApproachesForReuse] = useState<Approach[]>([]);

  useEffect(() => {
    async function fetchVotes() {
      setLoading(true);
      try {
        const nowISO = new Date().toISOString();
        const { data, error } = await supabase
          .from("votes")
          .select("id, title, status, stage3_end")
          .or(`status.eq.draft,stage3_end.gt.${nowISO},stage3_end.is.null`)
          .order("title");

        if (error) throw error;
        setVotes(data || []);
      } catch (err) {
        console.error("Error fetching votes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVotes();
  }, []);

  useEffect(() => {
    if (selectedVoteId) fetchIssuesForVote(selectedVoteId);
    else {
      setIssues([]);
      setSelectedIssueId("");
    }
  }, [selectedVoteId]);

  useEffect(() => {
    if (selectedIssueId) fetchApproachesForIssue(selectedIssueId);
    else {
      setApproaches([]);
      setSelectedApproachId("");
    }
  }, [selectedIssueId]);

  useEffect(() => {
    if (selectedApproachId) fetchPlansForApproach(selectedApproachId);
    else setPlans([]);
  }, [selectedApproachId]);

  useEffect(() => {
    if (targetVoteId) fetchIssuesForVote(targetVoteId, true);
    else {
      setIssuesForReuse([]);
      setTargetIssueId("");
    }
  }, [targetVoteId]);

  useEffect(() => {
    if (targetIssueId) fetchApproachesForIssue(targetIssueId, true);
    else {
      setApproachesForReuse([]);
      setTargetApproachId("");
    }
  }, [targetIssueId]);

  useEffect(() => {
    if (showReuseForm) fetchReusePlans();
  }, [showReuseForm]);

  async function fetchIssuesForVote(voteId: string, forReuse = false) {
    try {
      const { data, error } = await supabase
        .from("issues")
        .select("id, title, vote_id")
        .eq("vote_id", voteId)
        .order("title");
      if (error) throw error;
      if (forReuse) setIssuesForReuse(data || []);
      else setIssues(data || []);
    } catch (err) {
      console.error("Error fetching issues:", err);
      if (forReuse) setIssuesForReuse([]);
      else setIssues([]);
    }
  }

  async function fetchApproachesForIssue(issueId: string, forReuse = false) {
    try {
      const { data, error } = await supabase
        .from("approaches")
        .select("id, title, issue_id")
        .eq("issue_id", issueId)
        .order("title");
      if (error) throw error;
      if (forReuse) setApproachesForReuse(data || []);
      else setApproaches(data || []);
    } catch (err) {
      console.error("Error fetching approaches:", err);
      if (forReuse) setApproachesForReuse([]);
      else setApproaches([]);
    }
  }

  async function fetchPlansForApproach(approachId: string) {
    try {
      const { data, error } = await supabase
        .from("plans_with_votes")
        .select("*")
        .eq("approach_id", approachId)
        .order("order_index", { ascending: true });

      if (!error && data) {
        setPlans(data);
        return;
      }

      // Revert fallback to original: select only these fields and order by created_at ascending
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("id, title, description, approach_id, vote_id")
        .eq("approach_id", approachId)
        .order("created_at", { ascending: true });

      if (plansError) throw plansError;
      setPlans(plansData || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
      setPlans([]);
    }
  }

  async function fetchReusePlans() {
    setLoadingReuse(true);
    try {
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("id, title, description, approach_id, created_at")
        .order("created_at", { ascending: false });

      if (plansError) throw plansError;
      if (!plansData || plansData.length === 0) {
        setReusePlans([]);
        return;
      }

      const approachIds = [
        ...new Set(plansData.map((p: any) => p.approach_id).filter(Boolean)),
      ] as string[];

      const { data: approachesData } = approachIds.length
        ? await supabase
            .from("approaches")
            .select("id, title, issue_id")
            .in("id", approachIds)
        : { data: [] };

      const approachMap = (approachesData || []).reduce((acc: any, a: any) => {
        acc[a.id] = a;
        return acc;
      }, {} as Record<string, any>);

      const issueIds = [
        ...new Set(
          (approachesData || []).map((a: any) => a.issue_id).filter(Boolean)
        ),
      ] as string[];

      const { data: issuesData } = issueIds.length
        ? await supabase
            .from("issues")
            .select("id, title, vote_id")
            .in("id", issueIds)
        : { data: [] };

      const issueMap = (issuesData || []).reduce((acc: any, i: any) => {
        acc[i.id] = i;
        return acc;
      }, {} as Record<string, any>);

      const voteIds = [
        ...new Set((issuesData || []).map((i: any) => i.vote_id).filter(Boolean)),
      ] as string[];

      const { data: votesData } = voteIds.length
        ? await supabase.from("votes").select("id, title").in("id", voteIds)
        : { data: [] };

      const voteMap = (votesData || []).reduce((acc: any, v: any) => {
        acc[v.id] = v;
        return acc;
      }, {} as Record<string, any>);

      const formatted: ReusePlan[] = plansData.map((p: any) => {
        const approach = p.approach_id ? approachMap[p.approach_id] : null;
        const issue = approach ? issueMap[approach.issue_id] : null;
        const vote = issue ? voteMap[issue.vote_id] : null;

        return {
          id: p.id,
          title: p.title,
          description: p.description || "",
          approach_id: p.approach_id,
          approach_title: approach?.title || "Unknown approach",
          issue_title: issue?.title || "Unknown issue",
          vote_title: vote?.title || "Unknown vote",
          created_at: p.created_at,
        };
      });

      setReusePlans(formatted);
    } catch (err) {
      console.error("Error fetching reuse plans:", err);
      setReusePlans([]);
    } finally {
      setLoadingReuse(false);
    }
  }

  async function savePlan() {
    if (!planForm.title.trim()) return alert("Title is required");
    if (!selectedApproachId) return alert("Select an approach first");

    try {
      if (editingPlan) {
        const updatePayload: any = { ...planForm };
        if (selectedVoteId) updatePayload.vote_id = selectedVoteId;

        const { data, error } = await supabase
          .from("plans")
          .update(updatePayload)
          .eq("id", editingPlan.id)
          .select()
          .single();

        if (error) throw error;
        setPlans((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      } else {
        let nextOrderIndex = 1;
        if (plans.length > 0) {
          const maxOrderIndex = Math.max(...plans.map((p) => p.order_index ?? 0));
          nextOrderIndex = maxOrderIndex + 1;
        }

        const insertPayload: any = {
          ...planForm,
          approach_id: selectedApproachId,
          order_index: nextOrderIndex,
        };
        if (selectedVoteId) insertPayload.vote_id = selectedVoteId;

        const { data, error } = await supabase
          .from("plans")
          .insert([insertPayload])
          .select()
          .single();

        if (error) throw error;

        if (selectedApproachId) await fetchPlansForApproach(selectedApproachId);
        else setPlans((p) => (data ? [...p, data] : p));
      }

      resetForm();
    } catch (err: any) {
      console.error("Error saving plan:", err);
      alert("Error saving plan: " + (err.message || err));
    }
  }

  async function deletePlan(id: string) {
    if (!confirm("Delete this plan?")) return;
    try {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
      setPlans((p) => p.filter((x) => x.id !== id));
    } catch (err: any) {
      console.error("Error deleting plan:", err);
      alert("Error deleting plan: " + (err.message || err));
    }
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", index.toString());
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (dragIndex === dropIndex) return;
    const newPlans = [...plans];
    const [moved] = newPlans.splice(dragIndex, 1);
    newPlans.splice(dropIndex, 0, moved);

    const updates = newPlans
      .map((p, i) => {
        if (p.hasOwnProperty("order_index")) {
          return supabase
            .from("plans")
            .update({ order_index: i + 1 })
            .eq("id", p.id);
        }
        return null;
      })
      .filter(Boolean) as Promise<any>[];

    setPlans(newPlans);

    if (updates.length) {
      try {
        await Promise.all(updates);
      } catch (err) {
        console.error("Error updating plan order:", err);
        alert("Failed to persist plan order; refreshing list.");
        if (selectedApproachId) fetchPlansForApproach(selectedApproachId);
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleReusePlans() {
    if (selectedReusePlans.length === 0 || !targetApproachId || !targetVoteId) {
      alert("Select at least one plan and target vote/approach");
      return;
    }

    try {
      const selected = reusePlans.filter((p) => selectedReusePlans.includes(p.id));
      const toInsert = selected.map((p) => ({
        title: p.title,
        description: p.description || null,
        approach_id: targetApproachId,
        vote_id: targetVoteId,
      }));

      const { data, error } = await supabase.from("plans").insert(toInsert).select();
      if (error) throw error;

      if (targetApproachId === selectedApproachId) {
        await fetchPlansForApproach(selectedApproachId);
      }

      alert(`Reused ${Array.isArray(data) ? data.length : selected.length} plan(s)`);
      setShowReuseForm(false);
      setSelectedReusePlans([]);
      setTargetVoteId("");
      setTargetIssueId("");
      setTargetApproachId("");
    } catch (err: any) {
      console.error("Error reusing plans:", err);
      alert("Error reusing plans: " + (err.message || err));
    }
  }

  function resetForm() {
    setEditingPlan(null);
    setPlanForm({
      title: "",
      description: "",
      order_index: plans && plans.length ? plans.length + 1 : 1,
    });
  }

  function handleSelectAllReuse() {
    setSelectedReusePlans(reusePlans.map((p) => p.id));
  }

  function handleDeselectAllReuse() {
    setSelectedReusePlans([]);
  }

  function handleToggleReusePlan(id: string) {
    setSelectedReusePlans((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (loading) return <p>Loading votes…</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Manage Plans</h3>
        <Button variant="secondary" onClick={() => setShowReuseForm(!showReuseForm)}>
          {showReuseForm ? "Cancel Reuse" : "Reuse Existing Plans"}
        </Button>
      </div>

      {showReuseForm && (
        <Card>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Reuse Existing Plans</h4>
            <p className="text-sm text-gray-600">
              Select plans from any vote and assign to a target approach.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Target Vote *</label>
              <select
                value={targetVoteId}
                onChange={(e) => setTargetVoteId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select target vote</option>
                {votes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Target Issue *</label>
              <select
                value={targetIssueId}
                onChange={(e) => setTargetIssueId(e.target.value)}
                className="w-full border rounded px-3 py-2"
                disabled={!targetVoteId}
              >
                <option value="">Select target issue</option>
                {issuesForReuse.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Target Approach *</label>
              <select
                value={targetApproachId}
                onChange={(e) => setTargetApproachId(e.target.value)}
                className="w-full border rounded px-3 py-2"
                disabled={!targetIssueId}
              >
                <option value="">Select target approach</option>
                {approachesForReuse.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Plans to Reuse *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllReuse}
                    className="text-xs text-blue-600"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllReuse}
                    className="text-xs text-gray-600"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {loadingReuse ? (
                <p>Loading plans...</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border rounded p-3 space-y-3">
                  {reusePlans.length === 0 ? (
                    <p className="text-sm text-gray-500">No plans found to reuse.</p>
                  ) : (
                    reusePlans.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReusePlans.includes(p.id)}
                          onChange={() => handleToggleReusePlan(p.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{p.title}</div>
                          {p.description && (
                            <div className="text-xs text-gray-600">{p.description}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {p.vote_title} → {p.issue_title} → {p.approach_title}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleReusePlans}
                disabled={
                  selectedReusePlans.length === 0 || !targetApproachId || !targetVoteId
                }
              >
                Reuse Selected Plans
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReuseForm(false);
                  setSelectedReusePlans([]);
                  setTargetVoteId("");
                  setTargetIssueId("");
                  setTargetApproachId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <label className="block text-sm font-medium mb-1">Select Vote</label>
        <select
          value={selectedVoteId}
          onChange={(e) => {
            setSelectedVoteId(e.target.value);
            setSelectedIssueId("");
            setSelectedApproachId("");
            setPlans([]);
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
          <label className="block text-sm font-medium mb-1">Select Issue</label>
          <select
            value={selectedIssueId}
            onChange={(e) => {
              setSelectedIssueId(e.target.value);
              setSelectedApproachId("");
              setPlans([]);
            }}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Choose issue</option>
            {issues.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </Card>
      )}

      {selectedIssueId && (
        <Card>
          <label className="block text-sm font-medium mb-1">Select Approach</label>
          <select
            value={selectedApproachId}
            onChange={(e) => setSelectedApproachId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Choose approach</option>
            {approaches.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </Card>
      )}

      {selectedApproachId && (
        <>
          <Card>
            <h4 className="font-medium mb-2">{editingPlan ? "Edit Plan" : "Create Plan"}</h4>

            <input
              type="text"
              value={planForm.title}
              onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
              placeholder="Title"
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />

            <textarea
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              placeholder="Description"
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />

            <div className="flex gap-2">
              <Button variant="primary" onClick={savePlan}>
                {editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
              {editingPlan && <Button variant="secondary" onClick={resetForm}>Cancel</Button>}
            </div>
          </Card>

          <div className="grid gap-4">
            {plans.length === 0 ? (
              <Card>
                <p className="text-gray-500 italic">No plans yet. Create one above.</p>
              </Card>
            ) : (
              plans.map((plan, index) => (
                <div
                  key={plan.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="border rounded-lg bg-white shadow-sm hover:shadow-md transition cursor-move"
                >
                  <Card>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <h5 className="font-semibold">{plan.title}</h5>
                        {plan.description && <p className="text-sm text-gray-600">{plan.description}</p>}
                        <div className="text-xs text-gray-500 mt-1">
                          {plan.vote_title} → {plan.issue_title} → {plan.approach_title}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingPlan(plan);
                            setPlanForm({
                              title: plan.title,
                              description: plan.description || "",
                              order_index: plan.order_index || 1,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deletePlan(plan.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}