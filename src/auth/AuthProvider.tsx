// src/auth/AuthProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { validateCredentials } from "@/services/users";

export type Role = "admin" | "user";

export type AuthUser = {
  id?: number;
  name?: string;
  email: string;
  role: Role;
  token?: string;
};

type Action = "read" | "create" | "update" | "delete";

type AuthContextShape = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, opts?: { remember?: boolean }) => Promise<void>;
  logout: () => void;
  can: (action: Action, resource?: string) => boolean;
  hasPermission: (action: Action, resource?: string) => boolean;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

const LS_KEY = "auth:user";

/** Reglas de autorización básicas */
function evaluatePermission(user: AuthUser | null, action: Action, resource?: string) {
  if (!user) return false;
  if (user.role === "admin") return true;

  // role: user
  if (resource === "usuarios") return false; // no ve gestión de usuarios
  if (action === "delete") return false;     // no puede eliminar en ningún recurso
  return true;                               // resto: ok
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        setUser(parsed);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string, opts: { remember?: boolean } = { remember: true }) => {
      const res = await validateCredentials(email, password);
      if (!res?.ok || !res.user) {
        // Mensaje EXACTO que quieres ver en el formulario
        throw new Error("Usuario o contraseña incorrecta");
      }
      const u: AuthUser = {
        id: res.user.id,
        name: res.user.name ?? res.user.email,
        email: res.user.email,
        role: res.user.role,
        token: res.token,
      };
      setUser(u);
      localStorage.setItem(LS_KEY, JSON.stringify(u));

      // Si NO quiere recordar, limpiamos al cerrar la pestaña (comportamiento similar a sesión)
      if (opts.remember === false) {
        const handler = () => localStorage.removeItem(LS_KEY);
        window.addEventListener("beforeunload", handler, { once: true });
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(LS_KEY);
  }, []);

  const can = useCallback(
    (action: Action, resource?: string) => evaluatePermission(user, action, resource),
    [user]
  );

  const value = useMemo<AuthContextShape>(
    () => ({
      user,
      loading,
      login,
      logout,
      can,
      hasPermission: can,
    }),
    [user, loading, login, logout, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
