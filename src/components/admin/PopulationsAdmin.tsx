"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";
import Button from "@/components/Button";

type PopulationType = "nation" | "state" | "city" | "organization" | "custom";

interface Population {
  id: string;
  name: string;
  description?: string | null;
  type: PopulationType;
  parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface User {
  id: string;
  email: string;
}

export default function PopulationsAdmin() {
  const [populations, setPopulations] = useState<Population[]>([]);
  const [loadingPopulations, setLoadingPopulations] = useState(true);

  // Create population form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PopulationType | "">("");
  const [parentId, setParentId] = useState<string | "">("");
  const [creating, setCreating] = useState(false);

  // Feedback messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Users and assignment state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [selectedPopulationId, setSelectedPopulationId] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);
  const [assignErrorMsg, setAssignErrorMsg] = useState<string | null>(null);

  // Removal state (single set used; no duplicates)
  const [assignedUsers, setAssignedUsers] = useState<User[]>([]);
  const [loadingAssignedUsers, setLoadingAssignedUsers] = useState(false);
  const [selectedRemoveUserIds, setSelectedRemoveUserIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const [removeSuccessMsg, setRemoveSuccessMsg] = useState<string | null>(null);
  const [removeErrorMsg, setRemoveErrorMsg] = useState<string | null>(null);

  // user_populations snapshot
  const [userPopulations, setUserPopulations] = useState<{ user_id: string; population_id: string }[]>([]);
  const [loadingUserPopulations, setLoadingUserPopulations] = useState(true);

  const populationTypes: PopulationType[] = ["nation", "state", "city", "organization", "custom"];

  // initial load
  useEffect(() => {
    fetchPopulations();
    fetchUsers();
    fetchUserPopulations();
  }, []);

  // when selected population changes, refresh assigned users and reset selections
  useEffect(() => {
    if (!selectedPopulationId) {
      setAssignedUsers([]);
      setSelectedUserIds([]);
      setSelectedRemoveUserIds([]);
      return;
    }
    fetchAssignedUsers(selectedPopulationId);
    setSelectedUserIds([]);
    setSelectedRemoveUserIds([]);
  }, [selectedPopulationId]);

  async function fetchPopulations() {
    setLoadingPopulations(true);
    try {
      const { data, error } = await supabase
        .from("populations")
        .select("id, name, description, type, parent_id")
        .order("name", { ascending: true });

      if (error) throw error;
      setPopulations((data as Population[]) || []);
    } catch (err: any) {
      console.error("Error fetching populations:", err);
      setErrorMsg(err?.message || "Failed to load populations");
      setPopulations([]);
    } finally {
      setLoadingPopulations(false);
    }
  }

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.from("users").select("id, email").order("email", { ascending: true });
      if (error) throw error;
      setUsers((data as User[]) || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setErrorMsg(err?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function fetchUserPopulations() {
    setLoadingUserPopulations(true);
    try {
      const { data, error } = await supabase.from("user_populations").select("user_id, population_id");
      if (error) throw error;
      setUserPopulations(data || []);
    } catch (err: any) {
      console.error("Error fetching user_populations:", err);
      setUserPopulations([]);
    } finally {
      setLoadingUserPopulations(false);
    }
  }

  async function fetchAssignedUsers(populationId: string) {
    setLoadingAssignedUsers(true);
    try {
      const { data, error } = await supabase
        .from("user_populations")
        .select("user_id, users(id, email)")
        .eq("population_id", populationId);

      if (error) throw error;

      const usersAssigned = (data || []).map((row: any) => ({
        id: row.user_id,
        email: row.users?.email ?? row.user_id, // fallback
      }));

      setAssignedUsers(usersAssigned);
    } catch (err: any) {
      console.error("Error fetching assigned users:", err);
      setRemoveErrorMsg(err?.message || "Failed to load assigned users");
      setAssignedUsers([]);
    } finally {
      setLoadingAssignedUsers(false);
    }
  }

  function clearMessagesLater() {
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
      setAssignSuccessMsg(null);
      setAssignErrorMsg(null);
      setRemoveSuccessMsg(null);
      setRemoveErrorMsg(null);
    }, 4000);
  }

  async function handleCreate() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg("Name is required.");
      clearMessagesLater();
      return;
    }
    if (!type) {
      setErrorMsg("Type is required.");
      clearMessagesLater();
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        parent_id: parentId || null,
      };

      const { data, error } = await supabase.from("populations").insert([payload]).select().single();
      if (error) throw error;

      setPopulations((prev) => [data as Population, ...prev]);
      setSuccessMsg(`Created population "${data.name}".`);
      setName("");
      setDescription("");
      setType("");
      setParentId("");
      clearMessagesLater();
    } catch (err: any) {
      console.error("Error creating population:", err);
      setErrorMsg(err?.message || "Failed to create population");
      clearMessagesLater();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this population? This will set parent_id to null on children (DB handles cascade).")) return;
    try {
      const { error } = await supabase.from("populations").delete().eq("id", id);
      if (error) throw error;
      setPopulations((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg("Population deleted.");
      // refresh user_populations snapshot to keep things consistent
      await fetchUserPopulations();
      clearMessagesLater();
    } catch (err: any) {
      console.error("Error deleting population:", err);
      setErrorMsg(err?.message || "Failed to delete population");
      clearMessagesLater();
    }
  }

  // Map for parent lookup
  const populationMap = Object.fromEntries(populations.map((p) => [p.id, p]));

  // Users not in selected population (based on snapshot userPopulations)
  const usersNotInSelectedPopulation = users.filter(
    (u) => !userPopulations.some((up) => up.user_id === u.id && up.population_id === selectedPopulationId)
  );

  async function handleAssignUsers() {
    setAssignErrorMsg(null);
    setAssignSuccessMsg(null);

    if (!selectedPopulationId) {
      setAssignErrorMsg("Please select a population.");
      clearMessagesLater();
      return;
    }
    if (selectedUserIds.length === 0) {
      setAssignErrorMsg("Please select at least one user to assign.");
      clearMessagesLater();
      return;
    }

    setAssigning(true);
    try {
      const inserts = selectedUserIds.map((user_id) => ({
        user_id,
        population_id: selectedPopulationId,
      }));

      const { error } = await supabase.from("user_populations").insert(inserts);
      if (error) throw error;

      await fetchUserPopulations();
      await fetchAssignedUsers(selectedPopulationId);

      setAssignSuccessMsg(`Assigned ${selectedUserIds.length} user(s) to population.`);
      setSelectedUserIds([]);
      clearMessagesLater();
    } catch (err: any) {
      console.error("Error assigning users:", err);
      setAssignErrorMsg(err?.message || "Failed to assign users");
      clearMessagesLater();
    } finally {
      setAssigning(false);
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  function toggleRemoveUserSelection(userId: string) {
    setSelectedRemoveUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleRemoveUsers() {
    setRemoveErrorMsg(null);
    setRemoveSuccessMsg(null);

    if (!selectedPopulationId) {
      setRemoveErrorMsg("Please select a population.");
      return;
    }
    if (selectedRemoveUserIds.length === 0) {
      setRemoveErrorMsg("Please select at least one user to remove.");
      return;
    }

    setRemoving(true);
    try {
      const { error } = await supabase
        .from("user_populations")
        .delete()
        .eq("population_id", selectedPopulationId)
        .in("user_id", selectedRemoveUserIds);
      if (error) throw error;

      await fetchUserPopulations();
      await fetchAssignedUsers(selectedPopulationId);

      setRemoveSuccessMsg(`Removed ${selectedRemoveUserIds.length} user(s) from population.`);
      setSelectedRemoveUserIds([]);
      clearMessagesLater();
    } catch (err: any) {
      console.error("Error removing users:", err);
      setRemoveErrorMsg(err?.message || "Failed to remove users");
      clearMessagesLater();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Manage Populations</h3>
      </div>

      {/* Create */}
      <Card>
        <h4 className="font-medium mb-3">Create Population</h4>

        {successMsg && <div className="text-sm text-green-700 mb-2">{successMsg}</div>}
        {errorMsg && <div className="text-sm text-red-700 mb-2">{errorMsg}</div>}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="w-full px-3 py-2 border rounded-lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="Population name (e.g. 'California residents')" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select className="w-full px-3 py-2 border rounded-lg" value={type} onChange={(e) => setType(e.target.value as PopulationType)}>
              <option value="">Select type</option>
              {populationTypes.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Parent Population (optional)</label>
            <select className="w-full px-3 py-2 border rounded-lg" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">No parent</option>
              {populations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="primary" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create Population"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setName("");
              setDescription("");
              setType("");
              setParentId("");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Existing */}
      <Card>
        <h4 className="font-medium mb-3">Existing Populations</h4>

        {loadingPopulations ? (
          <p>Loading populations…</p>
        ) : populations.length === 0 ? (
          <p className="text-gray-500">No populations found.</p>
        ) : (
          <div className="space-y-2">
            {populations.map((p) => {
              const parent = p.parent_id ? (populationMap[p.parent_id] as Population | undefined) : undefined;
              return (
                <div key={p.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium text-black">
                      {p.name} - {p.type}
                    </div>
                    {parent && (
                      <div className="text-sm mt-1 text-black">
                        Parent population: {parent.name} - {parent.type}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Assign users */}
      <Card>
        <h4 className="font-medium mb-3">Assign Users to Population</h4>

        {assignSuccessMsg && <div className="text-sm text-green-700 mb-2">{assignSuccessMsg}</div>}
        {assignErrorMsg && <div className="text-sm text-red-700 mb-2">{assignErrorMsg}</div>}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Population</label>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={selectedPopulationId}
            onChange={(e) => {
              setSelectedPopulationId(e.target.value);
            }}
          >
            <option value="">-- Select a population --</option>
            {populations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type})
              </option>
            ))}
          </select>
        </div>

        {loadingUsers || loadingUserPopulations ? (
          <p>Loading users…</p>
        ) : selectedPopulationId === "" ? (
          <p className="text-gray-500">Select a population to assign users.</p>
        ) : usersNotInSelectedPopulation.length === 0 ? (
          <p className="text-gray-500">All users are already assigned to this population.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto border rounded p-2 mb-4">
            {usersNotInSelectedPopulation.map((user) => (
              <label key={user.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleUserSelection(user.id)} className="cursor-pointer" />
                <span>{user.email}</span>
              </label>
            ))}
          </div>
        )}

        <Button variant="primary" onClick={handleAssignUsers} disabled={assigning || selectedUserIds.length === 0}>
          {assigning ? "Assigning…" : "Assign Selected Users"}
        </Button>
      </Card>

      {/* Remove users */}
      <Card>
        <h4 className="font-medium mb-3">Remove Users from Population</h4>

        {removeSuccessMsg && <div className="text-sm text-green-700 mb-2">{removeSuccessMsg}</div>}
        {removeErrorMsg && <div className="text-sm text-red-700 mb-2">{removeErrorMsg}</div>}

        {loadingAssignedUsers ? (
          <p>Loading assigned users…</p>
        ) : selectedPopulationId === "" ? (
          <p className="text-gray-500">Select a population to remove users.</p>
        ) : assignedUsers.length === 0 ? (
          <p className="text-gray-500">No users assigned to this population.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto border rounded p-2 mb-4">
            {assignedUsers.map((user) => (
              <label key={user.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                <input type="checkbox" checked={selectedRemoveUserIds.includes(user.id)} onChange={() => toggleRemoveUserSelection(user.id)} className="cursor-pointer" />
                <span>{user.email}</span>
              </label>
            ))}
          </div>
        )}

        <Button variant="danger" onClick={handleRemoveUsers} disabled={removing || selectedRemoveUserIds.length === 0}>
          {removing ? "Removing…" : "Remove Selected Users"}
        </Button>
      </Card>
    </div>
  );
}