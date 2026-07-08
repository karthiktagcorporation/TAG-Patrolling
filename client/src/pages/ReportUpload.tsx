import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface UploadResult {
  fileName: string;
  plantName: string | null;
  patrolDate?: string;
  reportId: string | null;
  plannedTarget?: number;
  validAchieved?: number;
  achievedPercent?: number;
  error: string | null;
}

export default function ReportUpload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [fallbackDate, setFallbackDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (files.length === 0) return setError("Please select one or more PDF files.");
    setError("");
    setLoading(true);
    setResults(null);
    const form = new FormData();
    form.append("patrolDate", fallbackDate);
    files.forEach((f) => form.append("files", f));
    try {
      const res = await api.post("/reports/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      const rows: UploadResult[] = res.data.results;
      setResults(rows);
      // If exactly one file that succeeded, jump straight to its report.
      const ok = rows.filter((r) => r.reportId);
      if (rows.length === 1 && ok.length === 1) {
        navigate(`/reports/${ok[0].reportId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-tag-dark">Upload Patrol PDF</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-4">
        <p className="text-sm text-gray-500">
          Select one or more patrol PDFs. The plant and patrol date are detected automatically from each file's name
          (e.g. <code>TAG 1 A 16 June 26.pdf</code> → TAG 1A, 16 Jun 2026).
        </p>

        <label className="block text-sm">
          Patrol PDF(s)
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>

        {files.length > 0 && (
          <div className="text-sm text-gray-600">
            <div className="font-medium mb-1">{files.length} file(s) selected:</div>
            <ul className="list-disc list-inside">
              {files.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="block text-sm">
          Fallback Patrol Date <span className="text-gray-400">(used only if a filename has no date)</span>
          <input
            type="date"
            value={fallbackDate}
            onChange={(e) => setFallbackDate(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || files.length === 0}
          className="bg-tag-red text-white font-semibold rounded px-4 py-2 disabled:opacity-60"
        >
          {loading ? "Processing..." : `Upload & Validate ${files.length || ""}`.trim()}
        </button>
      </form>

      {results && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-3">Results</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">File</th>
                <th>Plant</th>
                <th>Date</th>
                <th>Achieved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.fileName} className="border-b last:border-0">
                  <td className="py-2">{r.fileName}</td>
                  <td>{r.plantName ?? <span className="text-red-600">—</span>}</td>
                  <td>{r.patrolDate ?? "—"}</td>
                  <td>
                    {r.error ? (
                      <span className="text-red-600 text-xs">{r.error}</span>
                    ) : (
                      `${r.validAchieved}/${r.plannedTarget} (${r.achievedPercent}%)`
                    )}
                  </td>
                  <td>
                    {r.reportId && (
                      <Link to={`/reports/${r.reportId}`} className="text-tag-red hover:underline">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
