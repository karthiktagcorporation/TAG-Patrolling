import { NavLink, Outlet, useNavigate } from "react-router-dom";
import TagLogo from "./TagLogo";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/plants", label: "Plant Master" },
  { to: "/reports/upload", label: "Upload Patrol PDF" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" }
];

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-tag-dark text-white flex flex-col no-print">
        <div className="p-4 border-b border-white/10 bg-white">
          <TagLogo height={56} />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-medium ${
                  isActive ? "bg-tag-red text-white" : "text-gray-200 hover:bg-white/10"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="m-3 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm">
          Logout
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
