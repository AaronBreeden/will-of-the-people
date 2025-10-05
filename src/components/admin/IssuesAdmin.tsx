"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";
import Button from "@/components/Button";

interface Issue {
  id: string;
  title: string;
  description?: string;
  vote_id: string;
  is_winner: boolean;
  weighted_votes?: number;
  total_votes?: number;
  created_at: string;
  updated_at: string;
}

interface Vote {
  id: string;
  title: string;
  status: string;
  stage1_end?: string;
}

interface ReuseIssue {
  id: string;
  title: string;
  description?: string;
  vote_id: string;
  vote_title: string;
  created_at: string;
}

export default function IssuesAdmin() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showReuseForm, setShowReuseForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  // Reuse functionality state - multi-select
  const [reuseIssues, setReuseIssues] = useState<ReuseIssue[]>([]);
  const [selectedReuseIssues, setSelectedReuseIssues] = useState<string[]>([]);
  const [targetVoteId, setTargetVoteId] = useState<string>("");
  const [loadingReuse, setLoadingReuse] = useState(false);

  const [newIssue, setNewIssue] = useState({
    title: "",
    description: "",
    vote_id: "",
  });

  useEffect(() => {
    async function fetchData() {
      // Fetch issues with weighted votes (most popular first)
      const { data: issuesData, error: issuesError } = await supabase
        .from("issues_with_votes")
        .select("*")
        .order("weighted_votes", { ascending: false });

      if (issuesError) {
        console.error("Error fetching issues:", issuesError);
      } else {
        setIssues(issuesData || []);
      }

      // Fetch votes (only draft and open status for creating new issues)
      const { data: votesData, error: votesError } = await supabase
        .from("votes")
        .select("id, title, status, stage1_end")
        .in("status", ["draft", "open"])
        .order("title");

      if (votesError) {
        console.error("Error fetching votes:", votesError);
      } else {
        setVotes(votesData || []);
      }

      // Fetch all votes for reuse functionality
      const { data: allVotesData, error: allVotesError } = await supabase
        .from("votes")
        .select("id, title, status, stage1_end")
        .order("created_at", { ascending: false });

      if (allVotesError) {
        console.error("Error fetching all votes:", allVotesError);
      } else {
        setAllVotes(allVotesData || []);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  // Fetch reuse issues when reuse form is opened
  useEffect(() => {
    if (showReuseForm) {
      fetchReuseIssues();
    }
  }, [showReuseForm]);

  const fetchReuseIssues = async () => {
    setLoadingReuse(true);
    const { data, error } = await supabase
      .from("issues")
      .select(`
        id,
        title,
        description,
        vote_id,
        created_at,
        votes!inner(title)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reuse issues:", error);
    } else {
      const formattedIssues = data?.map(issue => ({
        ...issue,
        vote_title: issue.votes.title
      })) || [];
      setReuseIssues(formattedIssues);
    }
    setLoadingReuse(false);
  };

  const handleCreateIssue = async () => {
    if (!newIssue.title || !newIssue.vote_id) {
      alert("Please fill Title and Vote");
      return;
    }

    setCreating(true);

    const cleanedIssue = {
      ...newIssue,
      description: newIssue.description || null,
    };

    const { data, error } = await supabase
      .from("issues")
      .insert([cleanedIssue])
      .select()
      .single();

    if (error) {
      console.error("Error creating issue:", error);
      alert("Error creating issue: " + error.message);
    } else {
      await refreshIssues();
      setNewIssue({
        title: "",
        description: "",
        vote_id: "",
      });
      setShowCreateForm(false);
    }
    setCreating(false);
  };

  // Multi-select reuse handler
  const handleReuseIssues = async () => {
    if (selectedReuseIssues.length === 0 || !targetVoteId) {
      alert("Please select at least one issue and a target vote");
      return;
    }

    setCreating(true);

    // Gather selected issues
    const selectedIssuesData = reuseIssues.filter(issue =>
      selectedReuseIssues.includes(issue.id)
    );

    const toInsert = selectedIssuesData.map(issue => ({
      vote_id: targetVoteId,
      title: issue.title,
      description: issue.description,
    }));

    const { error } = await supabase
      .from("issues")
      .insert(toInsert);

    if (error) {
      console.error("Error reusing issues:", error);
      alert("Error reusing issues: " + error.message);
    } else {
      await refreshIssues();
      setSelectedReuseIssues([]);
      setTargetVoteId("");
      setShowReuseForm(false);
    }
    setCreating(false);
  };

  const handleUpdateIssue = async (issueId: string) => {
    if (!editingIssue) return;

    // Check if the issue's parent vote is immutable (closed or stage1_end passed)
    const parentVote = allVotes.find(v => v.id === editingIssue.vote_id);
    const isImmutable = parentVote && (
      parentVote.status === "closed" ||
      (parentVote.stage1_end && new Date(parentVote.stage1_end) < new Date())
    );

    if (isImmutable) {
      // Clone the issue instead of updating in place
      const { error } = await supabase
        .from("issues")
        .insert([{
          vote_id: editingIssue.vote_id,
          title: editingIssue.title,
          description: editingIssue.description,
        }]);

      if (error) {
        alert("Error creating new version of issue: " + error.message);
      } else {
        alert("✅ New version created to preserve voting history");
        await refreshIssues();
        setEditingIssue(null);
      }
    } else {
      // Safe to update in place
      const { error } = await supabase
        .from("issues")
        .update({
          title: editingIssue.title,
          description: editingIssue.description,
        })
        .eq("id", issueId);

      if (error) {
        alert("Error updating issue: " + error.message);
      } else {
        await refreshIssues();
        setEditingIssue(null);
      }
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm("Are you sure you want to delete this issue?")) return;

    const { error } = await supabase
      .from("issues")
      .delete()
      .eq("id", issueId);

    if (error) {
      alert("Error deleting issue: " + error.message);
    } else {
      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
    }
  };

  const refreshIssues = async () => {
    const { data: refreshedIssues } = await supabase
      .from("issues_with_votes")
      .select("*")
      .order("weighted_votes", { ascending: false });
    
    setIssues(refreshedIssues || []);
  };

  const getVoteTitle = (voteId: string) => {
    const vote = allVotes.find((v) => v.id === voteId);
    return vote ? vote.title : "Unknown Vote";
  };

  const getVoteStatus = (voteId: string) => {
    const vote = allVotes.find((v) => v.id === voteId);
    return vote ? vote.status : "unknown";
  };

  const isVoteImmutable = (voteId: string) => {
    const vote = allVotes.find((v) => v.id === voteId);
    return vote && (
      vote.status === "closed" ||
      (vote.stage1_end && new Date(vote.stage1_end) < new Date())
    );
  };

  // Helpers for multi-select
  const handleSelectAllIssues = () => {
    setSelectedReuseIssues(reuseIssues.map(issue => issue.id));
  };

  const handleDeselectAllIssues = () => {
    setSelectedReuseIssues([]);
  };

  const handleToggleIssue = (issueId: string) => {
    if (selectedReuseIssues.includes(issueId)) {
      setSelectedReuseIssues(selectedReuseIssues.filter(id => id !== issueId));
    } else {
      setSelectedReuseIssues([...selectedReuseIssues, issueId]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Manage Issues</h3>
        <p>Loading issues and votes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Manage Issues</h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowReuseForm(!showReuseForm);
              setShowCreateForm(false);
            }}
          >
            {showReuseForm ? "Cancel Reuse" : "Reuse Existing Issues"}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setShowReuseForm(false);
            }}
          >
            {showCreateForm ? "Cancel" : "Create New Issue"}
          </Button>
        </div>
      </div>

      {/* Debug Info */}
      <div className="text-sm text-gray-700">
        <p>Issues loaded: {issues.length} (ordered by weighted votes)</p>
        <p>Available votes (draft/open): {votes.length}</p>
        {votes.length === 0 && (
          <p className="text-red-600">
            ⚠️ No draft or open votes found. Create a vote first.
          </p>
        )}
      </div>

      {/* Multi-select Reuse Form */}
      {showReuseForm && (
        <Card>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Reuse Existing Issues</h4>
            <p className="text-sm text-gray-600">
              Select multiple issues from previous votes and add them to a current draft/open vote.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Target Vote *</label>
              <select
                value={targetVoteId}
                onChange={(e) => setTargetVoteId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select target vote</option>
                {votes.map((vote) => (
                  <option key={vote.id} value={vote.id}>
                    {vote.title} ({vote.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Issues to Reuse *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllIssues}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllIssues}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              
              {loadingReuse ? (
                <p className="text-sm text-gray-500">Loading issues...</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border rounded p-3 space-y-3">
                  {reuseIssues.length === 0 ? (
                    <p className="text-sm text-gray-500">No issues found to reuse.</p>
                  ) : (
                    reuseIssues.map((issue) => (
                      <label key={issue.id} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          value={issue.id}
                          checked={selectedReuseIssues.includes(issue.id)}
                          onChange={() => handleToggleIssue(issue.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{issue.title}</p>
                          {issue.description && (
                            <p className="text-xs text-gray-600 mt-1">{issue.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Originally from: {issue.vote_title}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedReuseIssues.length > 0 && (
              <div className="p-3 bg-blue-50 rounded">
                <h5 className="font-medium mb-1">Selected Issues ({selectedReuseIssues.length}):</h5>
                <div className="text-sm text-gray-700">
                  {selectedReuseIssues.map(issueId => {
                    const issue = reuseIssues.find(i => i.id === issueId);
                    return issue ? (
                      <div key={issueId} className="flex justify-between items-center py-1">
                        <span>• {issue.title}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleIssue(issueId)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleReuseIssues}
                disabled={creating || selectedReuseIssues.length === 0 || !targetVoteId}
              >
                {creating ? "Adding..." : `Add ${selectedReuseIssues.length} Issue${selectedReuseIssues.length !== 1 ? 's' : ''} to Vote`}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReuseForm(false);
                  setSelectedReuseIssues([]);
                  setTargetVoteId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create New Issue Form */}
      {showCreateForm && (
        <Card>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Create New Issue</h4>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newIssue.title}
                onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Enter issue title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newIssue.description}
                onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                className="w-full border rounded px-3 py-2 h-20"
                placeholder="Describe the issue in detail"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vote *</label>
              <select
                value={newIssue.vote_id}
                onChange={(e) => setNewIssue({ ...newIssue, vote_id: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select a vote</option>
                {votes.map((vote) => (
                  <option key={vote.id} value={vote.id}>
                    {vote.title} ({vote.status})
                  </option>
                ))}
              </select>
              {votes.length === 0 && (
                <p className="text-sm text-red-600 mt-1">
                  No available votes. Create a draft or open vote first.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleCreateIssue}
                disabled={creating}
              >
                {creating ? "Creating..." : "Save Issue"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-semibold">
          Existing Issues ({issues.length}) - Ordered by Popularity
        </h4>

        {issues.length === 0 ? (
          <Card>
            <p className="text-gray-700">
              No issues found. Create your first issue above.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {issues.map((issue, index) => (
              <Card key={issue.id}>
                {editingIssue?.id === issue.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingIssue.title}
                      onChange={(e) => setEditingIssue({ ...editingIssue, title: e.target.value })}
                      className="w-full border rounded px-3 py-2 font-semibold"
                    />
                    <textarea
                      value={editingIssue.description || ""}
                      onChange={(e) => setEditingIssue({ ...editingIssue, description: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-20"
                    />
                    {isVoteImmutable(issue.vote_id) && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        ⚠️ <strong>Note:</strong> This issue belongs to a closed vote or past stage. 
                        Saving will create a new version to preserve voting history.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateIssue(issue.id)}
                      >
                        {isVoteImmutable(issue.vote_id) ? "Create New Version" : "Save Changes"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingIssue(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                          <h3 className="text-lg font-semibold">{issue.title}</h3>
                          {issue.is_winner && <span className="text-green-600 font-medium">🏆 Winner</span>}
                        </div>
                        <p className="text-sm text-gray-700">
                          Vote: {getVoteTitle(issue.vote_id)} 
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            getVoteStatus(issue.vote_id) === 'closed' ? 'bg-gray-100 text-gray-600' :
                            getVoteStatus(issue.vote_id) === 'open' ? 'bg-green-100 text-green-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {getVoteStatus(issue.vote_id)}
                          </span>
                          {isVoteImmutable(issue.vote_id) && (
                            <span className="ml-2 text-xs text-yellow-600">🔒 Immutable</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          Weighted Score: <span className="font-medium">{issue.weighted_votes?.toFixed(1) || '0.0'}</span>
                          {' '}({issue.total_votes || 0} votes)
                        </p>
                        {issue.description && (
                          <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingIssue(issue)}
                      >
                        {isVoteImmutable(issue.vote_id) ? "Clone & Edit" : "Edit"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteIssue(issue.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}