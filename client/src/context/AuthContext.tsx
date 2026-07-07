import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

interface AuthContextValue {
  authenticated: boolean | null;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get("/auth/session")
      .then((res) => setAuthenticated(res.data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  async function login(password: string) {
    await api.post("/auth/login", { password });
    setAuthenticated(true);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAuthenticated(false);
  }

  return <AuthContext.Provider value={{ authenticated, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
