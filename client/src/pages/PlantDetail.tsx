import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

export default function PlantDetail() {
  const { id } = useParams();
  const [plant, setPlant] = useState<any>(null);
  const [newCheckpoint, setNewCheckpoint] = useState("");
  const [newAlias, setNewAlias] = useState<Record<string, string>>({});

  function refresh() {
    api.get(`/plants/${id}`).then((res) => setPlant(res.data));
  }

  useEffect(refresh, [id]);

  async function saveMeta(field: string, value: any) {
    await api.put(`/plants/${id}`, { ...plant, [field]: value });
    refresh();
  }

  async function addCheckpoint() {
    if (!newCheckpoint.trim()) return;
    await api.post(`/plants/${id}/checkpoints`, { name: newCheckpoint, order: plant.checkpoints.length });
    setNewCheckpoint("");
    refresh();
  }

  async function removeCheckpoint(cpId: string) {
    await api.delete(`/plants/checkpoints/${cpId}`);
    refresh();
  }

  async function addAlias(cpId: string) {
    const alias = newAlias[cpId];
    if (!alias?.trim()) return;
    await api.post("/aliases", { checkpointId: cpId, alias, approved: true });
    setNewAlias((s) => ({ ...s, [cpId]: "" }));
    refresh();
  }

  async function removeAlias(aliasId: string) {
    await api.delete(`/aliases/${aliasId}`);
    refresh();
  }

  async function updateRound(index: number, field: "label" | "startTime", value: string) {
    const rounds = plant.roundSchedules.map((r: any, i: number) => (i === index ? { ...r, [field]: value } : r));
    await api.put(`/plants/${id}/rounds`, { rounds: rounds.map((r: any, i: number) => ({ ...r, order: i })) });
    refresh();
  }

  if (!plant) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tag-dark">{plant.name}</h1>

      <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 gap-4 max-w-2xl">
        <label className="text-sm">
          Target Count
          <input
            type="number"
            defaultValue={plant.targetCount}
            onBlur={(e) => saveMeta("targetCount", Number(e.target.value))}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>
        <label className="text-sm">
          Tolerance (minutes)
          <input
            type="number"
            defaultValue={plant.toleranceMinutes}
            onBlur={(e) => saveMeta("toleranceMinutes", Number(e.target.value))}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>
        <label className="text-sm col-span-2">
          Notes
          <textarea
            defaultValue={plant.notes ?? ""}
            onBlur={(e) => saveMeta("notes", e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Checkpoints & Aliases</h2>
        <div className="space-y-3">
          {plant.checkpoints.map((cp: any) => (
            <div key={cp.id} className="border rounded p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">{cp.name}</span>
                <button onClick={() => removeCheckpoint(cp.id)} className="text-xs text-red-600">
                  Remove
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {cp.aliases.map((a: any) => (
                  <span key={a.id} className="bg-gray-100 rounded px-2 py-1 text-xs flex items-center gap-1">
                    {a.alias}
                    <button onClick={() => removeAlias(a.id)} className="text-red-500">
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={newAlias[cp.id] ?? ""}
                  onChange={(e) => setNewAlias((s) => ({ ...s, [cp.id]: e.target.value }))}
                  placeholder="Add alias e.g. PDF spelling variant"
                  className="border rounded px-2 py-1 text-sm flex-1"
                />
                <button onClick={() => addAlias(cp.id)} className="bg-tag-dark text-white px-2 py-1 rounded text-sm">
                  Add Alias
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={newCheckpoint}
            onChange={(e) => setNewCheckpoint(e.target.value)}
            placeholder="New checkpoint name"
            className="border rounded px-2 py-1 flex-1"
          />
          <button onClick={addCheckpoint} className="bg-tag-dark text-white px-3 py-1 rounded">
            Add Checkpoint
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Round Timings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">Label</th>
              <th>Start Time (HH:mm)</th>
            </tr>
          </thead>
          <tbody>
            {plant.roundSchedules
              .slice()
              .sort((a: any, b: any) => a.order - b.order)
              .map((r: any, i: number) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">
                    <input
                      defaultValue={r.label}
                      onBlur={(e) => updateRound(i, "label", e.target.value)}
                      className="border rounded px-2 py-1"
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={r.startTime}
                      onBlur={(e) => updateRound(i, "startTime", e.target.value)}
                      className="border rounded px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
