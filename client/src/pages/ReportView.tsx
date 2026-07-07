import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import TagLogo from "../components/TagLogo";

const BADGE: Record<string, string> = {
  VALID: "bg-green-100 text-green-700",
  ALIAS_MATCHED: "bg-teal-100 text-teal-700",
  MISSING: "bg-red-100 text-red-700",
  DUPLICATE: "bg-yellow-100 text-yellow-700",
  EXTRA: "bg-orange-100 text-orange-700",
  MALFUNCTION: "bg-purple-100 text-purple-700",
  OUT_OF_TIME: "bg-pink-100 text-pink-700",
  REVIEW_REQUIRED: "bg-blue-100 text-blue-700",
  OUT_OF_SEQUENCE: "bg-indigo-100 text-indigo-700"
};

function Badge({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${BADGE[status] ?? "bg-gray-100"}`}>{status}</span>;
}

export default function ReportView() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  function refresh() {
    api.get(`/reports/${id}`).then((res) => {
      setReport(res.data);
      setRemarks(res.data.remarks ?? "");
    });
  }

  useEffect(refresh, [id]);

  const filteredRecords = useMemo(() => {
    if (!report) return [];
    if (filter === "ALL") return report.parsedRecords;
    if (filter === "OUT_OF_SEQUENCE") return report.parsedRecords.filter((r: any) => r.outOfSequence);
    return report.parsedRecords.filter((r: any) => r.status === filter);
  }, [report, filter]);

  const roundSummary = useMemo(() => {
    if (!report?.roundSummaryJson) return null;
    try {
      return JSON.parse(report.roundSummaryJson) as {
        label: string;
        startTime: string;
        expectedCount: number;
        achievedCount: number;
        checkpoints: { checkpointId: string; name: string; order: number; status: string }[];
      }[];
    } catch {
      return null;
    }
  }, [report]);

  async function submitRemarks() {
    if (!remarks.trim()) {
      setRemarksError("Remarks are required before printing/exporting.");
      return;
    }
    await api.put(`/reports/${id}/remarks`, { remarks });
    setShowRemarksModal(false);
    setTimeout(() => window.print(), 200);
  }

  if (!report) return <div>Loading report...</div>;

  const summary = [
    { label: "Plant", value: report.plant.name },
    { label: "Patrol Date", value: report.patrolDate },
    { label: "Target", value: report.plannedTarget },
    { label: "Valid Achieved", value: report.validAchieved },
    { label: "Achieved %", value: `${report.achievedPercent}%` },
    { label: "Missing", value: report.missingCount },
    { label: "Duplicate", value: report.duplicateCount },
    { label: "Extra", value: report.extraCount },
    { label: "Malfunction", value: report.malfunctionCount },
    { label: "Review Required", value: report.reviewCount },
    { label: "Out of Sequence", value: report.outOfSequenceCount ?? 0 },
    { label: "Generated", value: new Date(report.createdAt).toLocaleString() }
  ];

  return (
    <div className="space-y-6">
      <div className="print-only items-center gap-3 mb-2">
        <TagLogo height={48} />
        <div>
          <div className="font-bold text-lg">TAG Patrolling — Validation Result</div>
          <div className="text-sm text-gray-600">
            {report.plant.name} · {report.patrolDate}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center no-print">
        <h1 className="text-2xl font-bold text-tag-dark">Validation Result</h1>
        <button onClick={() => setShowRemarksModal(true)} className="bg-tag-red text-white px-4 py-2 rounded font-semibold">
          Print / Save PDF
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label}>
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {report.remarks && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-gray-500">Remarks</div>
          <div className="font-medium">{report.remarks}</div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 no-print">
        <div className="flex gap-2 flex-wrap">
          {[
            "ALL",
            "VALID",
            "ALIAS_MATCHED",
            "MISSING",
            "DUPLICATE",
            "EXTRA",
            "MALFUNCTION",
            "OUT_OF_TIME",
            "REVIEW_REQUIRED",
            "OUT_OF_SEQUENCE"
          ].map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm ${filter === f ? "bg-tag-dark text-white" : "bg-gray-100"}`}
              >
                {f}
              </button>
            )
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Detailed Records</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">#</th>
              <th>Checkpoint</th>
              <th>Round</th>
              <th>Time</th>
              <th>Status</th>
              <th>Match Type</th>
              <th>Sequence</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2">{r.lineNumber}</td>
                <td>{r.normalizedCheckpoint ?? r.rawCheckpoint ?? "—"}</td>
                <td>{r.matchedRound ?? "—"}</td>
                <td>{r.normalizedTime ?? r.rawTime ?? "—"}</td>
                <td>
                  <Badge status={r.status} />
                </td>
                <td>{r.matchType ?? "—"}</td>
                <td>
                  {r.outOfSequence ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
                      OUT OF ORDER
                    </span>
                  ) : r.matchedRound ? (
                    <span className="text-xs text-gray-400">OK</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {roundSummary && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-3">Round-wise Validation Summary</h2>
          <div className="space-y-3">
            {roundSummary.map((r) => (
              <div key={r.label} className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">
                    {r.label} <span className="text-gray-400 font-normal">({r.startTime})</span>
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      r.achievedCount === r.expectedCount ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.achievedCount} / {r.expectedCount}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.checkpoints.map((c) => (
                    <span
                      key={c.checkpointId}
                      className={`px-2 py-0.5 rounded text-xs ${
                        c.status === "MISSING" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {c.order + 1}. {c.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 no-print">
        <button onClick={() => setShowRaw((s) => !s)} className="text-sm text-tag-red font-semibold">
          {showRaw ? "Hide" : "Show"} Debug / Raw Parse Panel
        </button>
        {showRaw && (
          <pre className="mt-3 bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-96">{report.rawText}</pre>
        )}
      </div>

      {showRemarksModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-2">Remarks Required</h3>
            <p className="text-sm text-gray-500 mb-3">Please enter remarks before printing/exporting this report.</p>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full border rounded px-2 py-1 h-24"
              autoFocus
            />
            {remarksError && <p className="text-sm text-red-600 mt-1">{remarksError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowRemarksModal(false)} className="px-3 py-1 rounded bg-gray-100">
                Cancel
              </button>
              <button onClick={submitRemarks} className="px-3 py-1 rounded bg-tag-red text-white font-semibold">
                Confirm & Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
