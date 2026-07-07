import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Plants() {
  const [plants, setPlants] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState(28);

  function refresh() {
    api.get("/plants").then((res) => setPlants(res.data));
  }

  useEffect(refresh, []);

  async function addPlant() {
    if (!newName.trim()) return;
    await api.post("/plants", { name: newName, targetCount: newTarget, toleranceMinutes: 30, active: true });
    setNewName("");
    setNewTarget(28);
    refresh();
  }

  async function toggleActive(p: any) {
    await api.put(`/plants/${p.id}`, { ...p, active: !p.active });
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tag-dark">Plant Master</h1>

      <div className="bg-white rounded-xl shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">Plant</th>
              <th>Active</th>
              <th>Checkpoints</th>
              <th>Target</th>
              <th>Tolerance (min)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{p.name}</td>
                <td>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      p.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {p.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td>{p.checkpoints.length}</td>
                <td>{p.targetCount}</td>
                <td>{p.toleranceMinutes}</td>
                <td>
                  <Link to={`/plants/${p.id}`} className="text-tag-red hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow p-4 max-w-md">
        <h2 className="font-semibold mb-3">Add Plant</h2>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Plant name"
            className="border rounded px-2 py-1 flex-1"
          />
          <input
            type="number"
            value={newTarget}
            onChange={(e) => setNewTarget(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
          <button onClick={addPlant} className="bg-tag-dark text-white px-3 py-1 rounded">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
