import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data));
  }, []);

  async function save() {
    await api.put("/settings", settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-tag-dark">Settings</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <label className="block text-sm">
          Default Global Round Tolerance (minutes)
          <input
            type="number"
            value={settings.defaultToleranceMinutes ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, defaultToleranceMinutes: e.target.value }))}
            className="border rounded px-2 py-1 w-full mt-1"
          />
        </label>
        <label className="block text-sm">
          Session Timeout (minutes)
          <input
            type="number"
            value={settings.sessionTimeoutMinutes ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, sessionTimeoutMinutes: e.target.value }))}
            className="border rounded px-2 py-1 w-full mt-1"
          />
          <span className="text-xs text-gray-400">Requires server restart to fully apply cookie max-age.</span>
        </label>
        <button onClick={save} className="bg-tag-dark text-white px-4 py-2 rounded font-semibold">
          Save Settings
        </button>
        {saved && <span className="ml-2 text-green-600 text-sm">Saved.</span>}
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-sm text-gray-600 space-y-2">
        <h2 className="font-semibold text-tag-dark">App Password</h2>
        <p>
          The login password is controlled via the <code>APP_PASSWORD</code> environment variable on the server
          (see <code>.env.example</code>). Changing it here is not supported for security reasons; edit the server's
          <code>.env</code> file and restart the server instead.
        </p>
        <h2 className="font-semibold text-tag-dark mt-3">Logo Replacement</h2>
        <p>
          Replace the placeholder mark in <code>client/src/components/TagLogo.tsx</code> with an <code>&lt;img&gt;</code>{" "}
          pointing to a same-size asset placed at <code>client/public/tag-logo.png</code>.
        </p>
      </div>
    </div>
  );
}
