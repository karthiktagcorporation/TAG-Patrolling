import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

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

  useEffect(() => {
    api.get("/history/dashboard").then((res) => setData(res.data));
  }, []);

  if (!data) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tag-dark">Dashboard</h1>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">Plant</th>
              <th>Date</th>
              <th>Achieved %</th>
              <th>Duplicates</th>
              <th>Extra</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2">{r.plant.name}</td>
                <td>{r.patrolDate}</td>
                <td>{r.achievedPercent}%</td>
                <td>{r.duplicateCount}</td>
                <td>{r.extraCount}</td>
                <td>
                  <Link to={`/reports/${r.id}`} className="text-tag-red hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {data.recent.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-4">
                  No validations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
