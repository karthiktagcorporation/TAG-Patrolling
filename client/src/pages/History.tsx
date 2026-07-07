import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function History() {
  const [reports, setReports] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [plantId, setPlantId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.get("/plants").then((res) => setPlants(res.data));
  }, []);

  function refresh() {
    api.get("/history", { params: { plantId: plantId || undefined, date: date || undefined, status: status || undefined } })
      .then((res) => setReports(res.data));
  }

  useEffect(refresh, [plantId, date, status]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tag-dark">History</h1>

      <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap">
        <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All Plants</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Any Status</option>
          <option value="GOOD">Good (&gt;=90%)</option>
          <option value="WARN">Warning (70-89%)</option>
          <option value="POOR">Poor (&lt;70%)</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">Plant</th>
              <th>Date</th>
              <th>Achieved %</th>
              <th>Missing</th>
              <th>Duplicate</th>
              <th>Extra</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2">{r.plant.name}</td>
                <td>{r.patrolDate}</td>
                <td>{r.achievedPercent}%</td>
                <td>{r.missingCount}</td>
                <td>{r.duplicateCount}</td>
                <td>{r.extraCount}</td>
                <td>
                  <Link to={`/reports/${r.id}`} className="text-tag-red hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-4">
                  No reports match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
