import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { validateCredentials, getUsers, type User } from "@/services/users";

type SessionUser = {
  id: string;
  name: string;      // nombre completo para mostrar
  username: string;  // login
  role: "admin" | "user";
};

type LoginOptions = { remember?: boolean };

type AuthContextShape = {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string, opts?: LoginOptions) => Promise<void>;
  logout: () => void;
  // permisos simples (lo usa <Protected/>)
  hasPermission: (action: "create" | "read" | "update" | "delete", resource?: string) => boolean;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

const SESSION_KEY = "session_user"; // guarda la sesión

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga de sesión persistida
  useEffect(() => {
    try {
      // Asegura que existan usuarios por defecto
      getUsers();
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setUser(JSON.parse(raw));
    } finally {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string, opts?: LoginOptions) {
    const u: User | null = validateCredentials(username.trim(), password.trim());
    if (!u) throw new Error("Usuario o contraseña incorrectos.");

    const sess: SessionUser = {
      id: u.id,
      name: `${u.nombre} ${u.apellido}`.trim(),
      username: u.username,
      role: u.role,
    };
    setUser(sess);
    if (opts?.remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }

  // Reglas simples de permisos (ajústalas si lo necesitas)
  const hasPermission = (action: "create" | "read" | "update" | "delete", resource?: string) => {
    if (!user) return false;
    if (user.role === "admin") return true;          // admin todo
    // user (operador)
    if (action === "delete") return false;           // operador no elimina nada
    if (resource === "usuarios") {                   // operador no gestiona usuarios
      return false;
    }
    return true;                                     // el resto sí
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
