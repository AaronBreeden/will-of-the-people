"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";
import Button from "@/components/Button";

interface Vote {
  id: string;
  title: string;
  description: string | null;
  status: string;
  stage: number | null;
  stage1_start: string | null;
  stage1_end: string | null;
  stage2_start: string | null;
  stage2_end: string | null;
  stage3_start: string | null;
  stage3_end: string | null;
  outcome: string | null;
  detail: string | null;
  created_at: string;
  updated_at: string;
}

interface Population {
  id: string;
  name: string;
}

function isoToInputValueUTC(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}

function inputValueToIsoUTC(inputVal?: string | null) {
  if (!inputVal) return null;
  const [datePart, timePart] = inputVal.split("T");
  if (!datePart || !timePart) return null;
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const timeParts = timePart.split(":");
  if (!yearStr || !monthStr || !dayStr || timeParts.length < 2) return null;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;

  const d = new Date(Date.UTC(year, month, day, hour, minute, second));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatUtcForDisplay(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}+00`;
}

function InlineDatePicker({
  label,
  id,
  value,
  defaultValue,
  onChange,
  onSave,
  isSaving,
  error,
}: {
  label?: string;
  id?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (iso?: string | null) => void;
  onSave?: (iso?: string | null) => Promise<void>;
  isSaving?: boolean;
  error?: string | null;
}) {
  const [localValue, setLocalValue] = useState(() => isoToInputValueUTC(value ?? defaultValue ?? null));

  useEffect(() => {
    setLocalValue(isoToInputValueUTC(value ?? defaultValue ?? null));
  }, [value, defaultValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    onChange?.(inputValueToIsoUTC(v));
  };

  const handleBlur = async () => {
    if (onSave) {
      await onSave(inputValueToIsoUTC(localValue));
    }
  };

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <input
          id={id}
          type="datetime-local"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-3 py-2 border rounded-lg ${error ? "border-red-500" : "border-gray-300"}`}
        />
        {isSaving && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="w-4 h-4 border-t-2 border-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

function Toast({ message, type, visible }: { message?: string; type?: "success" | "error" | "info"; visible: boolean }) {
  if (!visible || !message) return null;
  const bg =
    type === "success"
      ? "bg-emerald-500"
      : type === "error"
      ? "bg-rose-500"
      : "bg-sky-500";

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`max-w-sm px-4 py-2 rounded-md text-white shadow-lg ${bg} animate-fade-in`}
        role="status"
        aria-live="polite"
      >
        <div className="text-sm">{message}</div>
      </div>
    </div>
  );
}

export default function VotesAdmin() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [populations, setPopulations] = useState<Population[]>([]);
  const [votePopulationMap, setVotePopulationMap] = useState<Record<string, string | null>>({});
  const [newVote, setNewVote] = useState({
    title: "",
    description: "",
    population_id: "",
    stage1_start: "",
    stage1_end: "",
    stage2_start: "",
    stage2_end: "",
    stage3_start: "",
    stage3_end: "",
  });
  const [statusSelection, setStatusSelection] = useState<Record<string, string>>({});
  const [statusChangeVoteId, setStatusChangeVoteId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info"; visible: boolean }>({
    message: "",
    type: "success",
    visible: false,
  });

  const [savingFields, setSavingFields] = useState<Record<string, Record<string, boolean>>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, Record<string, string | null>>>({});

  const showToast = (message: string, type: "success" | "error" | "info" = "success", duration = 3000) => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, duration);
  };

  const statusesOrder: Array<"draft" | "open" | "closed"> = ["draft", "open", "closed"];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    draft: true,
    open: true,
    closed: true,
  });
  const [createFormExpanded, setCreateFormExpanded] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [{ data: votesData, error: votesErr }, { data: popsData, error: popsErr }] = await Promise.all([
          supabase.from("votes").select("*").order("created_at", { ascending: false }),
          supabase.from("populations").select("id, name").order("name", { ascending: true }),
        ]);
        if (votesErr) throw votesErr;
        if (popsErr) throw popsErr;

        const voteList: Vote[] = votesData || [];
        setVotes(voteList);
        setPopulations(popsData || []);

        const voteIds = voteList.map((v) => v.id);
        let map: Record<string, string | null> = {};
        if (voteIds.length > 0) {
          const { data: vpData, error: vpErr } = await supabase
            .from("vote_populations")
            .select("vote_id, population_id")
            .in("vote_id", voteIds);
          if (vpErr) throw vpErr;

          map = voteList.reduce((acc: Record<string, string | null>, v: Vote) => {
            acc[v.id] = null;
            return acc;
          }, {});

          (vpData || []).forEach((r: any) => {
            if (!map[r.vote_id]) {
              map[r.vote_id] = r.population_id;
            }
          });
        }

        setVotePopulationMap(map);

        const initialStatus: Record<string, string> = {};
        (voteList || []).forEach((vote: any) => {
          initialStatus[vote.id] = vote.status;
        });
        setStatusSelection(initialStatus);
      } catch (err) {
        console.error("Error fetching votes/populations/vote_populations:", err);
        showToast("Failed to load votes/populations", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const handleCreateVote = async () => {
    if (!newVote.title.trim()) {
      showToast("Title is required", "error");
      return;
    }

    try {
      const insertPayload: any = {
        title: newVote.title,
        description: newVote.description || null,
        stage1_start: newVote.stage1_start || null,
        stage1_end: newVote.stage1_end || null,
        stage2_start: newVote.stage2_start || null,
        stage2_end: newVote.stage2_end || null,
        stage3_start: newVote.stage3_start || null,
        stage3_end: newVote.stage3_end || null,
      };

      const { data, error } = await supabase.from("votes").insert([insertPayload]).select().single();
      if (error) throw error;
      const inserted: Vote = data as Vote;

      if (newVote.population_id) {
        try {
          const { error: vpErr } = await supabase
            .from("vote_populations")
            .insert([{ vote_id: inserted.id, population_id: newVote.population_id }]);
          if (vpErr) throw vpErr;
          setVotePopulationMap((p) => ({ ...p, [inserted.id]: newVote.population_id }));
        } catch (e: any) {
          console.error("Failed to insert vote_populations for new vote:", e);
          showToast("Failed to assign population to new vote", "error");
        }
      }

      setVotes((prev) => [inserted, ...prev]);
      setNewVote({
        title: "",
        description: "",
        population_id: "",
        stage1_start: "",
        stage1_end: "",
        stage2_start: "",
        stage2_end: "",
        stage3_start: "",
        stage3_end: "",
      });
      setCreateFormExpanded(false);

      showToast("Vote created", "success");
    } catch (err: any) {
      console.error("Error creating vote:", err);
      showToast(`Error creating vote: ${err?.message ?? String(err)}`, "error");
    }
  };

  const handleAssignPopulation = async (voteId: string, populationId: string | null) => {
    const vote = votes.find((v) => v.id === voteId);
    if (!vote) return;
    if (vote.status === "closed") {
      showToast("Cannot assign a population to a closed vote.", "error");
      return;
    }

    setVotePopulationMap((prev) => ({ ...prev, [voteId]: populationId }));

    try {
      const delRes = await supabase
        .from("vote_populations")
        .delete()
        .eq("vote_id", voteId);

      if (delRes.error) {
        throw new Error(`Delete failed: ${delRes.error.message}`);
      }

      if (populationId) {
        const insRes = await supabase
          .from("vote_populations")
          .insert([{ vote_id: voteId, population_id: populationId }]);

        if (insRes.error) {
          throw new Error(`Insert failed: ${insRes.error.message}`);
        }
        showToast("Population assigned", "success");
      } else {
        showToast("Population cleared", "success");
      }
    } catch (rawErr: any) {
      console.error("Error assigning population:", rawErr);
      const msg = rawErr?.message ?? (typeof rawErr === "object" ? JSON.stringify(rawErr) : String(rawErr));
      setValidationError("Failed to assign population: " + msg);
      showToast("Failed to assign population", "error");

      try {
        const { data: fresh, error: freshErr } = await supabase
          .from("vote_populations")
          .select("population_id")
          .eq("vote_id", voteId);

        if (!freshErr && fresh && fresh.length > 0) {
          setVotePopulationMap((prev) => ({
            ...prev,
            [voteId]: fresh[0].population_id,
          }));
        }
      } catch (revertErr) {
        console.error("Failed to revert population mapping:", revertErr);
      }
    }
  };

  const handleStatusChangeClick = (voteId: string, status: string) => {
    setStatusChangeVoteId(voteId);
    setNewStatus(status);
    setValidationError(null);
  };

  const confirmStatusChange = async () => {
    if (!statusChangeVoteId) return;
    setValidating(true);
    setValidationError(null);

    try {
      if (newStatus === "open") {
        const { data: voteData, error: voteErr } = await supabase
          .from("votes")
          .select("id, stage1_start")
          .eq("id", statusChangeVoteId)
          .single();
        if (voteErr || !voteData) throw new Error("Vote not found for validation.");
        if (!voteData.stage1_start) throw new Error("Stage 1 start date is required to open the vote.");

        const { data: vp } = await supabase.from("vote_populations").select("population_id").eq("vote_id", statusChangeVoteId).limit(1);
        if (!vp || vp.length === 0) throw new Error("At least one population must be assigned to the vote.");

        const { data: issues } = await supabase.from("issues").select("id, title").eq("vote_id", statusChangeVoteId);
        if (!issues || issues.length < 2) throw new Error("At least 2 issues are required to open the vote.");

        const issueIds = issues.map((i: any) => i.id);
        const { data: allBkqs } = await supabase
          .from("basic_knowledge_questions")
          .select("id, related_id, question, options, correct_answer")
          .in("related_id", issueIds)
          .eq("related_type", "issue");

        const bkqsByIssue = (allBkqs || []).reduce((acc: Record<string, any[]>, bkq: any) => {
          acc[bkq.related_id] = acc[bkq.related_id] || [];
          acc[bkq.related_id].push(bkq);
          return acc;
        }, {});

        for (const issue of issues) {
          const rows = bkqsByIssue[issue.id] || [];
          const validCount = rows.filter((b: any) => {
            const hasQuestion = !!(b.question && b.question.toString().trim());
            const optionsIsArray = Array.isArray(b.options);
            const optionsCount = optionsIsArray ? b.options.length : 0;
            const hasCorrect = !!(b.correct_answer && b.correct_answer.toString().trim());
            return hasQuestion && optionsCount >= 2 && hasCorrect;
          }).length;

          if (validCount < 3) {
            throw new Error(`Issue "${issue.title || issue.id}" must have at least 3 BKQs.`);
          }
        }
      }

      const { error } = await supabase.from("votes").update({ status: newStatus }).eq("id", statusChangeVoteId);
      if (error) throw error;

      setVotes((prev) => prev.map((vote) => (vote.id === statusChangeVoteId ? { ...vote, status: newStatus } : vote)));
      setStatusSelection((prev) => ({ ...prev, [statusChangeVoteId]: newStatus }));
      setStatusChangeVoteId(null);
      showToast("Status updated", "success");
    } catch (err: any) {
      console.error("Error changing status:", err);
      setValidationError(err.message);
      showToast(err?.message ?? "Failed to change status", "error");
    } finally {
      setValidating(false);
    }
  };

  const handleSaveDetails = async (voteId: string) => {
    const outcome = (document.getElementById(`outcome-${voteId}`) as HTMLInputElement)?.value;
    const detail = (document.getElementById(`detail-${voteId}`) as HTMLTextAreaElement)?.value;

    try {
      const { error } = await supabase.from("votes").update({ outcome, detail }).eq("id", voteId);
      if (error) throw error;

      setVotes((prev) => prev.map((vote) => (vote.id === voteId ? { ...vote, outcome, detail } : vote)));
      showToast("Vote details saved!", "success");
    } catch (err: any) {
      console.error("Error saving vote details:", err);
      showToast("Error saving vote details: " + (err?.message ?? String(err)), "error");
    }
  };

  const handleUpdateVote = async (voteId: string) => {
    const vote = votes.find((v) => v.id === voteId);
    if (!vote) return;

    try {
      const titleVal = (document.getElementById(`title-${voteId}`) as HTMLInputElement)?.value;
      const descriptionVal = (document.getElementById(`description-${voteId}`) as HTMLTextAreaElement)?.value;

      const stage1_start_input = (document.getElementById(`stage1_start-${voteId}`) as HTMLInputElement)?.value || null;
      const stage1_end_input = (document.getElementById(`stage1_end-${voteId}`) as HTMLInputElement)?.value || null;
      const stage2_start_input = (document.getElementById(`stage2_start-${voteId}`) as HTMLInputElement)?.value || null;
      const stage2_end_input = (document.getElementById(`stage2_end-${voteId}`) as HTMLInputElement)?.value || null;
      const stage3_start_input = (document.getElementById(`stage3_start-${voteId}`) as HTMLInputElement)?.value || null;
      const stage3_end_input = (document.getElementById(`stage3_end-${voteId}`) as HTMLInputElement)?.value || null;

      const payload: any = {
        title: titleVal,
        description: descriptionVal,
        stage1_start: inputValueToIsoUTC(stage1_start_input),
        stage1_end: inputValueToIsoUTC(stage1_end_input),
        stage2_start: inputValueToIsoUTC(stage2_start_input),
        stage2_end: inputValueToIsoUTC(stage2_end_input),
        stage3_start: inputValueToIsoUTC(stage3_start_input),
        stage3_end: inputValueToIsoUTC(stage3_end_input),
      };

      const { error } = await supabase.from("votes").update(payload).eq("id", voteId);
      if (error) throw error;

      setVotes((prev) =>
        prev.map((v) =>
          v.id === voteId
            ? {
                ...v,
                ...payload,
              }
            : v
        )
      );
      setEditingVoteId(null);
      showToast("Vote updated successfully!", "success");
    } catch (err: any) {
      console.error("Error updating vote:", err);
      showToast("Error updating vote: " + (err?.message ?? String(err)), "error");
    }
  };

  const handleUpdateVoteField = async (voteId: string, field: keyof Vote, isoValue: string | null) => {
    const vote = votes.find((v) => v.id === voteId);
    if (!vote) return;

    if ((vote as any)[field] === isoValue) {
      return;
    }

    setSavingFields((prev) => ({
      ...prev,
      [voteId]: {
        ...prev[voteId],
        [field]: true,
      },
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [voteId]: {
        ...prev[voteId],
        [field]: null,
      },
    }));

    try {
      const payload: any = { [field]: isoValue || null };
      const { error } = await supabase.from("votes").update(payload).eq("id", voteId);

      if (error) throw error;

      setVotes((prev) => prev.map((v) => (v.id === voteId ? { ...v, ...payload } : v)));
      showToast("Saved", "success", 1500);
    } catch (err: any) {
      console.error("Error saving vote field", field, err);
      setFieldErrors((prev) => ({
        ...prev,
        [voteId]: {
          ...prev[voteId],
          [field]: err?.message ?? "Failed to save",
        },
      }));
      showToast("Failed to save date", "error");
    } finally {
      setSavingFields((prev) => ({
        ...prev,
        [voteId]: {
          ...prev[voteId],
          [field]: false,
        },
      }));
    }
  };

  const toggleSection = (status: string) => {
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  if (loading) return <p>Loading votes...</p>;

  const grouped: Record<string, Vote[]> = {
    draft: votes.filter((v) => v.status === "draft"),
    open: votes.filter((v) => v.status === "open"),
    closed: votes.filter((v) => v.status === "closed"),
  };

  const PopulationControl = ({ vote }: { vote: Vote }) => {
    const currentPopulationId = votePopulationMap[vote.id] ?? null;
    const current = populations.find((p) => p.id === currentPopulationId);
    const allowed = vote.status === "draft" || vote.status === "open";

    if (!allowed) {
      return (
        <div className="text-sm text-gray-700">
          Population: <span className="font-medium">{current?.name ?? "—"}</span>
        </div>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium mb-1">Population</label>
        <div className="flex gap-2">
          <select
            value={currentPopulationId ?? ""}
            onChange={(e) => handleAssignPopulation(vote.id, e.target.value || null)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">— None —</option>
            {populations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAssignPopulation(vote.id, null)}
            aria-label="Clear population"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Clear
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <h3 className="text-xl font-semibold">Manage Votes</h3>

      <Card>
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Create New Vote</h4>
          <Button
            variant="primary"
            onClick={() => setCreateFormExpanded(!createFormExpanded)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {createFormExpanded ? "Hide Form" : "Create New Vote"}
          </Button>
        </div>

        {createFormExpanded && (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={newVote.title}
              onChange={(e) => setNewVote({ ...newVote, title: e.target.value })}
              placeholder="Vote Title"
              className="w-full px-3 py-2 border rounded-lg"
            />
            <textarea
              value={newVote.description}
              onChange={(e) => setNewVote({ ...newVote, description: e.target.value })}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border rounded-lg h-24"
            />

            <div>
              <label className="block text-sm font-medium mb-1">Population (optional)</label>
              <select
                value={newVote.population_id}
                onChange={(e) => setNewVote((prev) => ({ ...prev, population_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">— None —</option>
                {populations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InlineDatePicker
                label="Stage 1 Start"
                value={newVote.stage1_start || ""}
                onChange={(iso) => setNewVote((prev) => ({ ...prev, stage1_start: iso || "" }))}
              />
              <InlineDatePicker
                label="Stage 1 End"
                value={newVote.stage1_end || ""}
                onChange={(iso) => setNewVote((prev) => ({ ...prev, stage1_end: iso || "" }))}
              />
              <InlineDatePicker
                label="Stage 2 Start"
                value={newVote.stage2_start || ""}
                onChange={(iso) => setNewVote((prev) => ({ ...prev, stage2_start: iso || "" }))}
              />
              <InlineDatePicker
                label="Stage 2 End"
                value={newVote.stage2_end || ""}
                onChange={(iso) => setNewVote((prev) => ({ ...prev, stage2_end: iso || "" }))}
              />
              <InlineDatePicker
                label="Stage 3 Start"
                value={newVote.stage3_start || ""}
                onChange={(iso) => setNewVote((prev) => ({ ...prev, stage3_start: iso || "" }))}
              />
              <InlineDatePicker
                label="Stage 3 End"
                value={newVote.stage3_end || ""}
                onChange={(iso) => setNewVote((prev) => ({ ...prev, stage3_end: iso || "" }))}
              />
            </div>

            <Button variant="primary" onClick={handleCreateVote} className="bg-blue-600 text-white hover:bg-blue-700">
              Create Vote
            </Button>
          </div>
        )}
      </Card>

      {statusChangeVoteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <h4 className="text-lg font-semibold mb-3">Confirm Status Change</h4>

            {validationError ? (
              <div className="text-red-600 mb-3">{validationError}</div>
            ) : validating ? (
              <p>Validating vote configuration...</p>
            ) : (
              <p>
                Are you sure you want to change the status to <strong>{newStatus}</strong>?
              </p>
            )}

            <div className="flex gap-2 mt-4">
              {!validationError && !validating && (
                <Button variant="primary" onClick={confirmStatusChange} className="bg-blue-600 text-white hover:bg-blue-700">
                  Confirm
                </Button>
              )}
              <Button variant="secondary" onClick={() => setStatusChangeVoteId(null)} className="bg-gray-200 text-gray-800">
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <h3 className="text-xl font-semibold">Manage existing votes</h3>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => showToast("Publish selected action triggered", "info")}
        >
          Publish Selected
        </Button>
        <Button
          variant="primary"
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => showToast("Close selected action triggered", "info")}
        >
          Close Selected
        </Button>
        <Button
          variant="primary"
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => showToast("Export results action triggered", "info")}
        >
          Export Results
        </Button>
      </div>

      <div className="space-y-4">
        {statusesOrder.map((status) => {
          const list = grouped[status] || [];
          const title = status.charAt(0).toUpperCase() + status.slice(1);
          return (
            <Card key={status}>
              <div className="flex items-center justify-between">
                <div>
                  <button
                    onClick={() => toggleSection(status)}
                    className={`text-left w-full flex items-center gap-3 bg-blue-600 text-white px-3 py-1 rounded ${expanded[status] ? "rounded-b-none" : ""}`}
                    aria-expanded={!!expanded[status]}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${expanded[status] ? "transform rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M6 6L14 10L6 14V6Z" />
                    </svg>
                    <span className="font-semibold text-lg">{title}</span>
                    <span className="text-sm text-gray-500 ml-2">({list.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [status]: true }))}
                    className="text-sm px-2 py-1 border rounded bg-gray-50"
                  >
                    Expand
                  </button>
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [status]: false }))}
                    className="text-sm px-2 py-1 border rounded bg-gray-50"
                  >
                    Collapse
                  </button>
                </div>
              </div>

              {expanded[status] && (
                <div className="mt-4 space-y-3">
                  {list.length === 0 ? (
                    <Card>
                      <p className="text-gray-500 italic">No {status} votes.</p>
                    </Card>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      {list.map((vote) => (
                        <Card key={vote.id}>
                          {editingVoteId === vote.id ? (
                            <div className="space-y-3">
                              <input
                                id={`title-${vote.id}`}
                                type="text"
                                defaultValue={vote.title}
                                className="w-full px-3 py-2 border rounded-lg font-semibold text-xl"
                              />
                              <textarea
                                id={`description-${vote.id}`}
                                defaultValue={vote.description || ""}
                                className="w-full px-3 py-2 border rounded-lg h-24"
                              />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <InlineDatePicker
                                  label="Stage 1 Start"
                                  id={`stage1_start-${vote.id}`}
                                  defaultValue={vote.stage1_start || ""}
                                  onSave={(iso) => handleUpdateVoteField(vote.id, "stage1_start", iso)}
                                  isSaving={savingFields[vote.id]?.stage1_start}
                                  error={fieldErrors[vote.id]?.stage1_start}
                                />
                                <InlineDatePicker
                                  label="Stage 1 End"
                                  id={`stage1_end-${vote.id}`}
                                  defaultValue={vote.stage1_end || ""}
                                  onSave={(iso) => handleUpdateVoteField(vote.id, "stage1_end", iso)}
                                  isSaving={savingFields[vote.id]?.stage1_end}
                                  error={fieldErrors[vote.id]?.stage1_end}
                                />
                                <InlineDatePicker
                                  label="Stage 2 Start"
                                  id={`stage2_start-${vote.id}`}
                                  defaultValue={vote.stage2_start || ""}
                                  onSave={(iso) => handleUpdateVoteField(vote.id, "stage2_start", iso)}
                                  isSaving={savingFields[vote.id]?.stage2_start}
                                  error={fieldErrors[vote.id]?.stage2_start}
                                />
                                <InlineDatePicker
                                  label="Stage 2 End"
                                  id={`stage2_end-${vote.id}`}
                                  defaultValue={vote.stage2_end || ""}
                                  onSave={(iso) => handleUpdateVoteField(vote.id, "stage2_end", iso)}
                                  isSaving={savingFields[vote.id]?.stage2_end}
                                  error={fieldErrors[vote.id]?.stage2_end}
                                />
                                <InlineDatePicker
                                  label="Stage 3 Start"
                                  id={`stage3_start-${vote.id}`}
                                  defaultValue={vote.stage3_start || ""}
                                  onSave={(iso) => handleUpdateVoteField(vote.id, "stage3_start", iso)}
                                  isSaving={savingFields[vote.id]?.stage3_start}
                                  error={fieldErrors[vote.id]?.stage3_start}
                                />
                                <InlineDatePicker
                                  label="Stage 3 End"
                                  id={`stage3_end-${vote.id}`}
                                  defaultValue={vote.stage3_end || ""}
                                  onSave={(iso) => handleUpdateVoteField(vote.id, "stage3_end", iso)}
                                  isSaving={savingFields[vote.id]?.stage3_end}
                                  error={fieldErrors[vote.id]?.stage3_end}
                                />
                              </div>

                              <PopulationControl vote={vote} />

                              <div className="flex gap-2">
                                <Button variant="primary" onClick={() => handleUpdateVote(vote.id)} className="bg-blue-600 text-white hover:bg-blue-700">Save</Button>
                                <Button variant="secondary" onClick={() => setEditingVoteId(null)} className="bg-gray-200 text-gray-800">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <h3 className="text-xl font-semibold">{vote.title}</h3>
                                <p className="text-sm text-gray-700">
                                  Stage {vote.stage ?? "—"} • Status: <span className="font-medium bg-blue-600 text-white px-2 py-1 rounded-full">{vote.status}</span>
                                </p>
                                {vote.description && <p className="text-sm text-gray-600 mt-1">{vote.description}</p>}

                                <div className="text-sm text-gray-600 space-y-1 mt-2">
                                  <div>
                                    <strong>Stage 1:</strong>{" "}
                                    {vote.stage1_start ? formatUtcForDisplay(vote.stage1_start) : "—"}{" "}
                                    {vote.stage1_end ? `— ${formatUtcForDisplay(vote.stage1_end)}` : ""}
                                  </div>
                                  <div>
                                    <strong>Stage 2:</strong>{" "}
                                    {vote.stage2_start ? formatUtcForDisplay(vote.stage2_start) : "—"}{" "}
                                    {vote.stage2_end ? `— ${formatUtcForDisplay(vote.stage2_end)}` : ""}
                                  </div>
                                  <div>
                                    <strong>Stage 3:</strong>{" "}
                                    {vote.stage3_start ? formatUtcForDisplay(vote.stage3_start) : "—"}{" "}
                                    {vote.stage3_end ? `— ${formatUtcForDisplay(vote.stage3_end)}` : ""}
                                  </div>
                                </div>
                              </div>

                              <PopulationControl vote={vote} />

                              <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <div className="flex gap-2">
                                  <select
                                    value={statusSelection[vote.id] ?? vote.status}
                                    onChange={(e) => setStatusSelection((prev) => ({ ...prev, [vote.id]: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    disabled={vote.status === "closed"}
                                  >
                                    <option value="draft">Draft</option>
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                  </select>

                                  <Button
                                    variant="primary"
                                    size="sm"
                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                    onClick={() => {
                                      const desired = statusSelection[vote.id] ?? vote.status;
                                      handleStatusChangeClick(vote.id, desired);
                                    }}
                                    disabled={vote.status === "closed"}
                                  >
                                    Change
                                  </Button>

                                  {vote.status === "closed" && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="bg-blue-600 text-white hover:bg-blue-700"
                                      onClick={() => handleStatusChangeClick(vote.id, "open")}
                                    >
                                      Reopen
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1">Outcome</label>
                                <input
                                  type="text"
                                  defaultValue={vote.outcome || ""}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                  id={`outcome-${vote.id}`}
                                  placeholder="Enter outcome summary"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1">Details</label>
                                <textarea
                                  defaultValue={vote.detail || ""}
                                  className="w-full px-3 py-2 border rounded-lg text-sm h-24"
                                  id={`detail-${vote.id}`}
                                  placeholder="Enter detailed results"
                                />
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-blue-600 text-white hover:bg-blue-700"
                                  onClick={() => handleSaveDetails(vote.id)}
                                  disabled={vote.status === "closed"}
                                >
                                  {vote.status === "closed" ? "Already Closed" : "Save"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-blue-600 text-white hover:bg-blue-700"
                                  onClick={() => setEditingVoteId(vote.id)}
                                >
                                  Edit
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}