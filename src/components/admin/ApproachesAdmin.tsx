"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";
import Button from "@/components/Button";

interface Approach {
  id: string;
  title: string;
  description?: string | null;
  vote_id: string;
  issue_id: string;
  is_winner?: boolean;
  weighted_votes?: number | null;
  total_votes?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface Issue {
  id: string;
  title: string;
  vote_id: string;
}

interface Vote {
  id: string;
  title: string;
  status: string;
  stage2_end?: string | null;
}

interface ReuseApproach {
  id: string;
  title: string;
  description?: string | null;
  vote_id: string;
  vote_title: string;
  issue_id: string;
  issue_title: string;
  created_at?: string;
}

export default function ApproachesAdmin() {
  // Data state
  const [votes, setVotes] = useState<Vote[]>([]);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [issuesByVote, setIssuesByVote] = useState<Record<string, Issue[]>>({});
  const [issuesForCreate, setIssuesForCreate] = useState<Issue[]>([]);
  const [issuesForReuse, setIssuesForReuse] = useState<Issue[]>([]);
  const [approachesByIssue, setApproachesByIssue] = useState<Record<string, Approach[]>>({});
  const [reuseApproaches, setReuseApproaches] = useState<ReuseApproach[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingReuse, setLoadingReuse] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showReuseForm, setShowReuseForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingApproach, setEditingApproach] = useState<Approach | null>(null);

  // Collapsible tree state
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  // Form states
  const [newApproach, setNewApproach] = useState({
    title: "",
    description: "",
    vote_id: "",
    issue_id: "",
  });

  const [targetVoteId, setTargetVoteId] = useState("");
  const [targetIssueId, setTargetIssueId] = useState("");
  const [selectedReuseApproaches, setSelectedReuseApproaches] = useState<string[]>(
    []
  );

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch all primary data: votes -> issues -> approaches
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();

      // 1) votes (filtered)
      const { data: votesData, error: votesError } = await supabase
        .from("votes")
        .select("id, title, status, stage2_end")
        .or(`status.eq.draft,stage2_end.is.null,stage2_end.gt.${nowISO}`)
        .order("title");

      if (votesError) throw votesError;
      setVotes(votesData || []);

      // allVotes for edit/lookup logic
      const { data: allVotesData, error: allVotesError } = await supabase
        .from("votes")
        .select("id, title, status, stage2_end")
        .order("created_at", { ascending: false });
      if (allVotesError) console.warn("allVotes load error", allVotesError);
      setAllVotes(allVotesData || []);

      const voteIds = (votesData || []).map((v: Vote) => v.id);
      if (voteIds.length === 0) {
        setIssuesByVote({});
        setApproachesByIssue({});
        setLoading(false);
        return;
      }

      // 2) issues for votes
      const { data: issuesData, error: issuesError } = await supabase
        .from("issues")
        .select("id, title, vote_id")
        .in("vote_id", voteIds)
        .order("title");

      if (issuesError) throw issuesError;

      // group issues by vote_id (string keys)
      const issuesGrouped: Record<string, Issue[]> = {};
      (issuesData || []).forEach((issue: Issue) => {
        const key = String(issue.vote_id);
        if (!issuesGrouped[key]) issuesGrouped[key] = [];
        issuesGrouped[key].push(issue);
      });
      setIssuesByVote(issuesGrouped);

      // 3) approaches for those issues
      const issueIds = (issuesData || []).map((i: Issue) => i.id);
      if (issueIds.length === 0) {
        setApproachesByIssue({});
        setLoading(false);
        return;
      }

      // Use approaches_with_votes view if it exists (server hint suggested this).
      // If your project view name differs, update the string below.
      const { data: approachesData, error: approachesError } = await supabase
        .from("approaches_with_votes") // <-- corrected view name
        .select("*")
        .in("issue_id", issueIds)
        .order("weighted_votes", { ascending: false });

      if (approachesError) {
        // log full error and fallback to simple approaches table fetch
        console.warn("approaches_with_votes fetch error, falling back to approaches table", approachesError);
        const { data: fallback, error: fallbackError } = await supabase
          .from("approaches")
          .select("id, title, description, vote_id, issue_id, created_at")
          .in("issue_id", issueIds)
          .order("created_at", { ascending: false });
        if (fallbackError) throw fallbackError;
        // Group fallback by issue_id
        const groupedFallback: Record<string, Approach[]> = {};
        (fallback || []).forEach((a: any) => {
          const key = String(a.issue_id);
          if (!groupedFallback[key]) groupedFallback[key] = [];
          groupedFallback[key].push(a);
        });
        setApproachesByIssue(groupedFallback);
      } else {
        // Group by issue_id (ensure string keys)
        const approachesGrouped: Record<string, Approach[]> = {};
        (approachesData || []).forEach((a: any) => {
          const key = String(a.issue_id);
          if (!approachesGrouped[key]) approachesGrouped[key] = [];
          approachesGrouped[key].push(a);
        });
        setApproachesByIssue(approachesGrouped);
      }

      // Debug logs (remove later)
      console.debug("Votes loaded:", votesData?.length || 0);
      console.debug("Issues grouped by vote:", Object.keys(issuesGrouped).length);
      console.debug("Approaches grouped (keys):", Object.keys(approachesByIssue));
    } catch (err) {
      console.error("Error fetching ApproachesAdmin data:", err);
    } finally {
      setLoading(false);
    }
  };

  // When create form vote changes, fetch issues for that vote
  useEffect(() => {
    if (newApproach.vote_id) fetchIssuesForVote(newApproach.vote_id, false);
    else {
      setIssuesForCreate([]);
      setNewApproach((p) => ({ ...p, issue_id: "" }));
    }
  }, [newApproach.vote_id]);

  // When target vote changes for reuse, fetch issues
  useEffect(() => {
    if (targetVoteId) fetchIssuesForVote(targetVoteId, true);
    else {
      setIssuesForReuse([]);
      setTargetIssueId("");
    }
  }, [targetVoteId]);

  const fetchIssuesForVote = async (voteId: string, forReuse: boolean) => {
    const { data, error } = await supabase
      .from("issues")
      .select("id, title")
      .eq("vote_id", voteId)
      .order("title");

    if (error) {
      console.error("Error fetching issues for vote:", error);
      if (forReuse) setIssuesForReuse([]);
      else setIssuesForCreate([]);
      return;
    }

    if (forReuse) setIssuesForReuse(data || []);
    else setIssuesForCreate(data || []);
  };

  // Reuse approaches list (when reuse UI opens)
  useEffect(() => {
    if (showReuseForm) fetchReuseApproaches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReuseForm]);

  const fetchReuseApproaches = async () => {
    setLoadingReuse(true);
    try {
      const { data, error } = await supabase
        .from("approaches")
        .select(`
          id,
          title,
          description,
          vote_id,
          created_at,
          votes!inner(title),
          issues!inner(id, title)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: ReuseApproach[] =
        (data || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          vote_id: a.vote_id,
          vote_title: a.votes?.title || "",
          issue_id: a.issues?.id || "",
          issue_title: a.issues?.title || "",
          created_at: a.created_at,
        })) || [];

      setReuseApproaches(formatted);
    } catch (err) {
      console.error("Error fetching reuse approaches:", err);
      setReuseApproaches([]);
    } finally {
      setLoadingReuse(false);
    }
  };

  // Create
  const handleCreateApproach = async () => {
    if (!newApproach.title || !newApproach.vote_id || !newApproach.issue_id) {
      alert("Please fill Title, Vote, and Issue");
      return;
    }
    setCreating(true);
    try {
      const cleaned = {
        ...newApproach,
        description: newApproach.description || null,
      };
      const { error } = await supabase.from("approaches").insert([cleaned]);
      if (error) throw error;
      await fetchAllData();
      setNewApproach({ title: "", description: "", vote_id: "", issue_id: "" });
      setShowCreateForm(false);
    } catch (err: any) {
      console.error("Error creating approach:", err);
      alert("Error creating approach: " + (err?.message || String(err)));
    } finally {
      setCreating(false);
    }
  };

  // Reuse (multi-insert)
  const handleReuseApproaches = async () => {
    if (selectedReuseApproaches.length === 0 || !targetVoteId || !targetIssueId) {
      alert("Please select at least one approach, target vote, and target issue");
      return;
    }
    setCreating(true);
    try {
      const selectedData = reuseApproaches.filter((a) =>
        selectedReuseApproaches.includes(a.id)
      );
      const toInsert = selectedData.map((a) => ({
        vote_id: targetVoteId,
        issue_id: targetIssueId,
        title: a.title,
        description: a.description || null,
      }));
      const { error } = await supabase.from("approaches").insert(toInsert);
      if (error) throw error;
      await fetchAllData();
      setSelectedReuseApproaches([]);
      setTargetVoteId("");
      setTargetIssueId("");
      setShowReuseForm(false);
    } catch (err: any) {
      console.error("Error reusing approaches:", err);
      alert("Error reusing approaches: " + (err?.message || String(err)));
    } finally {
      setCreating(false);
    }
  };

  // Update approach (with cloning for immutable vote)
  const handleUpdateApproach = async (id: string) => {
    if (!editingApproach) return;
    try {
      const parentVote = allVotes.find((v) => v.id === editingApproach.vote_id);
      const isImmutable =
        parentVote &&
        (parentVote.status === "closed" ||
          (parentVote.stage2_end && new Date(parentVote.stage2_end) < new Date()));

      if (isImmutable) {
        const { error } = await supabase.from("approaches").insert([
          {
            vote_id: editingApproach.vote_id,
            issue_id: editingApproach.issue_id,
            title: editingApproach.title,
            description: editingApproach.description || null,
          },
        ]);
        if (error) throw error;
        alert("✅ New version created to preserve voting history");
      } else {
        const { error } = await supabase
          .from("approaches")
          .update({
            title: editingApproach.title,
            description: editingApproach.description || null,
            issue_id: editingApproach.issue_id,
          })
          .eq("id", id);
        if (error) throw error;
      }
      await fetchAllData();
      setEditingApproach(null);
    } catch (err: any) {
      console.error("Error updating approach:", err);
      alert("Error updating approach: " + (err?.message || String(err)));
    }
  };

  // Delete
  const handleDeleteApproach = async (id: string) => {
    if (!confirm("Are you sure you want to delete this approach?")) return;
    try {
      const { error } = await supabase.from("approaches").delete().eq("id", id);
      if (error) throw error;
      // remove locally to avoid re-fetch flicker
      setApproachesByIssue((prev) => {
        const copy = { ...prev };
        Object.keys(copy).forEach((key) => {
          copy[key] = copy[key].filter((a) => a.id !== id);
        });
        return copy;
      });
    } catch (err: any) {
      console.error("Error deleting approach:", err);
      alert("Error deleting approach: " + (err?.message || String(err)));
    }
  };

  // Refresh wrapper (alias)
  const refreshData = async () => {
    await fetchAllData();
  };

  // Tree toggles
  const toggleVote = (voteId: string) => {
    setExpandedVotes((prev) => {
      const copy = new Set(prev);
      if (copy.has(voteId)) copy.delete(voteId);
      else copy.add(voteId);
      return copy;
    });
  };
  const toggleIssue = (issueId: string) => {
    setExpandedIssues((prev) => {
      const copy = new Set(prev);
      if (copy.has(issueId)) copy.delete(issueId);
      else copy.add(issueId);
      return copy;
    });
  };

  // Reuse helpers
  const handleSelectAllReuse = () => {
    setSelectedReuseApproaches(reuseApproaches.map((a) => a.id));
  };
  const handleDeselectAllReuse = () => setSelectedReuseApproaches([]);
  const handleToggleReuseApproach = (id: string) => {
    setSelectedReuseApproaches((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Form vote change handlers
  const onVoteChangeCreate = (voteId: string) => {
    setNewApproach((p) => ({ ...p, vote_id: voteId, issue_id: "" }));
    fetchIssuesForVote(voteId, false);
  };
  const onVoteChangeReuse = (voteId: string) => {
    setTargetVoteId(voteId);
    setTargetIssueId("");
    fetchIssuesForVote(voteId, true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Manage Approaches</h3>
        <p>Loading votes, issues, and approaches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + action buttons */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Manage Approaches</h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowReuseForm((s) => !s);
              setShowCreateForm(false);
            }}
          >
            {showReuseForm ? "Cancel Reuse" : "Reuse Existing Approaches"}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowCreateForm((s) => !s);
              setShowReuseForm(false);
            }}
          >
            {showCreateForm ? "Cancel" : "Create New Approach"}
          </Button>
        </div>
      </div>

      {/* Reuse form */}
      {showReuseForm && (
        <Card>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Reuse Existing Approaches</h4>
            <p className="text-sm text-gray-600">
              Select approaches from other votes to add into a target vote + issue.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Target Vote *</label>
              <select
                value={targetVoteId}
                onChange={(e) => onVoteChangeReuse(e.target.value)}
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
                disabled={!targetVoteId || issuesForReuse.length === 0}
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
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Approaches to Reuse *</label>
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
                <p>Loading approaches...</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border rounded p-3 space-y-3">
                  {reuseApproaches.length === 0 ? (
                    <p className="text-sm text-gray-500">No approaches found to reuse.</p>
                  ) : (
                    reuseApproaches.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReuseApproaches.includes(a.id)}
                          onChange={() => handleToggleReuseApproach(a.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{a.title}</div>
                          {a.description && (
                            <div className="text-xs text-gray-600">{a.description}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            From: {a.vote_title} / {a.issue_title}
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
                onClick={handleReuseApproaches}
                disabled={creating || selectedReuseApproaches.length === 0 || !targetVoteId || !targetIssueId}
              >
                {creating ? "Adding..." : `Add ${selectedReuseApproaches.length} Approach${selectedReuseApproaches.length !== 1 ? "es" : ""}`}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReuseForm(false);
                  setSelectedReuseApproaches([]);
                  setTargetVoteId("");
                  setTargetIssueId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Create New Approach</h4>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newApproach.title}
                onChange={(e) => setNewApproach({ ...newApproach, title: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newApproach.description}
                onChange={(e) => setNewApproach({ ...newApproach, description: e.target.value })}
                className="w-full border rounded px-3 py-2 h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vote *</label>
              <select
                value={newApproach.vote_id}
                onChange={(e) => onVoteChangeCreate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select a vote</option>
                {votes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Issue *</label>
              <select
                value={newApproach.issue_id}
                onChange={(e) => setNewApproach({ ...newApproach, issue_id: e.target.value })}
                className="w-full border rounded px-3 py-2"
                disabled={!newApproach.vote_id || issuesForCreate.length === 0}
              >
                <option value="">Select an issue</option>
                {issuesForCreate.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleCreateApproach} disabled={creating}>
                {creating ? "Creating..." : "Save Approach"}
              </Button>
              <Button variant="secondary" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Collapsible tree view */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold">Existing Approaches by Vote and Issue</h4>

        {votes.length === 0 ? (
          <Card>
            <p>No draft or open stage2 votes found.</p>
          </Card>
        ) : (
          votes.map((vote) => (
            <div key={vote.id} className="mb-4 border rounded shadow-sm">
              <button
                onClick={() => toggleVote(vote.id)}
                className="w-full text-left px-4 py-2 bg-blue-100 hover:bg-blue-200 font-semibold rounded-t"
                aria-expanded={expandedVotes.has(vote.id)}
              >
                {expandedVotes.has(vote.id) ? "▼" : "▶"} {vote.title} ({vote.status})
              </button>

              {expandedVotes.has(vote.id) && (
                <div className="pl-6 py-2 bg-blue-50">
                  {(issuesByVote[String(vote.id)] && issuesByVote[String(vote.id)].length > 0) ? (
                    issuesByVote[String(vote.id)].map((issue) => {
                      const issueKey = String(issue.id);
                      const issueApproaches = approachesByIssue[issueKey] || [];
                      return (
                        <div key={issue.id} className="mb-2">
                          <button
                            onClick={() => toggleIssue(issue.id)}
                            className="w-full text-left px-3 py-1 bg-blue-200 hover:bg-blue-300 rounded font-medium"
                          >
                            {expandedIssues.has(issue.id) ? "▼" : "▶"} {issue.title}
                          </button>

                          {expandedIssues.has(issue.id) && (
                            <ul className="pl-6 mt-1 list-disc list-inside">
                              {issueApproaches.length > 0 ? (
                                issueApproaches.map((approach) => (
                                  <li key={approach.id} className="py-1">
                                    <div className="flex justify-between items-start gap-3">
                                      <div>
                                        <div className="font-semibold">
                                          {approach.title}{" "}
                                          {approach.is_winner && <span className="text-green-600">🏆</span>}
                                        </div>
                                        {approach.description && (
                                          <div className="text-sm text-gray-700">{approach.description}</div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-1">
                                          Weighted Score: {approach.weighted_votes?.toFixed?.(1) ?? "—"} ({approach.total_votes ?? 0} votes)
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => setEditingApproach(approach)}
                                        >
                                          Edit
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => handleDeleteApproach(approach.id)}
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Inline edit area */}
                                    {editingApproach?.id === approach.id && (
                                      <div className="mt-2 p-2 border rounded bg-white">
                                        <input
                                          type="text"
                                          value={editingApproach.title}
                                          onChange={(e) =>
                                            setEditingApproach({ ...editingApproach, title: e.target.value })
                                          }
                                          className="w-full border rounded px-3 py-2 mb-2"
                                        />
                                        <textarea
                                          value={editingApproach.description || ""}
                                          onChange={(e) =>
                                            setEditingApproach({ ...editingApproach, description: e.target.value })
                                          }
                                          className="w-full border rounded px-3 py-2 mb-2"
                                        />
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Issue</label>
                                          <select
                                            value={editingApproach.issue_id}
                                            onChange={(e) =>
                                              setEditingApproach({ ...editingApproach, issue_id: e.target.value })
                                            }
                                            className="w-full border rounded px-3 py-2"
                                          >
                                            {/* Limit options to issues within the same vote */}
                                            {(issuesByVote[String(approach.vote_id)] || []).map((iss) => (
                                              <option key={iss.id} value={iss.id}>
                                                {iss.title}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                          <Button variant="primary" size="sm" onClick={() => handleUpdateApproach(approach.id)}>
                                            Save
                                          </Button>
                                          <Button variant="secondary" size="sm" onClick={() => setEditingApproach(null)}>
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </li>
                                ))
                              ) : (
                                <li className="text-gray-500 italic">No approaches found</li>
                              )}
                            </ul>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-gray-500 italic px-3 py-2">No issues found</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}