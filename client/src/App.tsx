import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Plants from "./pages/Plants";
import PlantDetail from "./pages/PlantDetail";
import ReportUpload from "./pages/ReportUpload";
import ReportView from "./pages/ReportView";
import History from "./pages/History";

function Protected({ children }: { children: JSX.Element }) {
  const { authenticated } = useAuth();
  if (authenticated === null) return <div className="p-6">Loading...</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/plants" element={<Plants />} />
            <Route path="/plants/:id" element={<PlantDetail />} />
            <Route path="/reports/upload" element={<ReportUpload />} />
            <Route path="/reports/:id" element={<ReportView />} />
            <Route path="/history" element={<History />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
