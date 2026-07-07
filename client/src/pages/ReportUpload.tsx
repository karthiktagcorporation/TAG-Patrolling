import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function ReportUpload() {
  const navigate = useNavigate();
  const [plants, setPlants] = useState<any[]>([]);
  const [plantId, setPlantId] = useState("");
  const [patrolDate, setPatrolDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/plants").then((res) => {
      setPlants(res.data.filter((p: any) => p.active));
      if (res.data.length) setPlantId(res.data[0].id);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError("Please select a PDF file.");
    setError("");
    setLoading(true);
    const form = new FormData();
    form.append("plantId", plantId);
    form.append("patrolDate", patrolDate);
    form.append("file", file);
    try {
      const res = await api.post("/reports/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      navigate(`/reports/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-tag-dark">Upload Patrol PDF</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-4">
        <label className="block text-sm">
          Plant
          <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className="border rounded px-2 py-1 w-full mt-1">
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Patrol Date
          <input
            type="date"
            value={patrolDate}
            onChange={(e) => setPatrolDate(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>
        <label className="block text-sm">
          Patrol PDF
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !plantId}
          className="bg-tag-red text-white font-semibold rounded px-4 py-2 disabled:opacity-60"
        >
          {loading ? "Processing..." : "Upload & Validate"}
        </button>
      </form>
    </div>
  );
}
