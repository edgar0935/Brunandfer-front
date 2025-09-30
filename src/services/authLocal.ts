// src/services/authLocal.ts
import type { Role, User } from "@/auth/types";

// ❗️No es seguro para producción: solo demo local
type StoredSession = { id: string; name: string; role: Role; ts: number };

const STORAGE_KEY = "app.session";

function hash(s: string): string {
  return btoa(s).split("").reverse().join("");
}

const USERS: Array<{
  email: string;
  passH: string;
  user: User;
}> = [
  {
    email: "admin@local",
    passH: hash("1234"),
    user: { id: "1", name: "Admin", role: "admin" },
  },
  {
    email: "operador@local",
    passH: hash("1234"),
    user: { id: "2", name: "Operador", role: "user" },
  },
];

export async function login(
  email: string,
  password: string,
  opts: { remember?: boolean } = { remember: true }
): Promise<User> {
  await delay(350); // simular latencia

  const rec = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!rec) throw new Error("Usuario o contraseña inválidos");

  const ok = rec.passH === hash(password);
  if (!ok) throw new Error("Usuario o contraseña inválidos");

  const s: StoredSession = { id: rec.user.id, name: rec.user.name, role: rec.user.role, ts: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));

  if (opts.remember === false) {
    window.addEventListener("beforeunload", () => localStorage.removeItem(STORAGE_KEY));
  }

  return rec.user;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSession(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as StoredSession;
    return { id: s.id, name: s.name, role: s.role };
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
