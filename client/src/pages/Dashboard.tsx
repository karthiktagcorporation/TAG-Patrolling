import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import TagLogo from "../components/TagLogo";

interface DashboardData {
  totalPlants: number;
  todayUploads: number;
  latestAchievedPercent: number | null;
  duplicateCount: number;
  missingCount: number;
  extraCount: number;
  malfunctionCount: number;
  recent: any[];
}

function Card({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [resetting, setResetting] = useState(false);

  function load() {
    api.get("/history/dashboard").then((res) => setData(res.data));
  }

  useEffect(load, []);

  async function handleReset() {
    if (!window.confirm("Reset all validation history? This permanently deletes every uploaded report. Plant Master data is kept.")) return;
    setResetting(true);
    try {
      await api.delete("/history/reset");
      load();
    } finally {
      setResetting(false);
    }
  }

  if (!data) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      {/* Print-only letterhead */}
      <div className="print-only items-center gap-3 mb-2">
        <TagLogo height={48} />
        <div>
          <div className="font-bold text-lg">TAG Patrolling — Dashboard</div>
          <div className="text-sm text-gray-600">Generated {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-tag-dark no-print">Dashboard</h1>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="text-sm bg-tag-dark text-white rounded px-3 py-1.5 hover:bg-black"
          >
            Print / Save PDF
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded px-3 py-1.5 disabled:opacity-60"
          >
            {resetting ? "Resetting..." : "Reset Data"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total Plants" value={data.totalPlants} color="text-tag-dark" />
        <Card label="Today's Uploads" value={data.todayUploads} color="text-tag-dark" />
        <Card
          label="Latest Achieved %"
          value={data.latestAchievedPercent != null ? `${data.latestAchievedPercent}%` : "—"}
          color="text-green-600"
        />
        <Card label="Duplicate Count" value={data.duplicateCount} color="text-yellow-600" />
        <Card label="Missing Count" value={data.missingCount} color="text-red-600" />
        <Card label="Extra Count" value={data.extraCount} color="text-orange-600" />
        <Card label="Malfunction Count" value={data.malfunctionCount} color="text-purple-600" />
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Recent Validations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Plant</th>
                <th>Date</th>
                <th>Target</th>
                <th>Valid</th>
                <th>Achieved %</th>
                <th>Missing</th>
                <th>Duplicate</th>
                <th>Extra</th>
                <th>Out of Time</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.plant.name}</td>
                  <td>{r.patrolDate}</td>
                  <td>{r.plannedTarget}</td>
                  <td className="text-green-700 font-semibold">{r.validAchieved}</td>
                  <td>{r.achievedPercent}%</td>
                  <td className="text-red-600">{r.missingCount}</td>
                  <td className="text-yellow-600">{r.duplicateCount}</td>
                  <td className="text-orange-600">{r.extraCount}</td>
                  <td className="text-pink-600">{r.outOfTimeCount}</td>
                  <td className="no-print">
                    <Link to={`/reports/${r.id}`} className="text-tag-red hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-gray-400 py-4">
                    No validations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
