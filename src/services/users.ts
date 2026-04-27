// src/services/users.ts
import { apiFetch } from "@/utils/api";   // helper central de fetch

export type Rol = "admin" | "user";

export type UserRow = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  role: Rol;
  isActive: 0 | 1;
  createdAt: string;
};

export type NewUser = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  role?: Rol;
  isActive?: 0 | 1;
};

export type UserPatch = Partial<{
  nombre: string;
  apellido: string;
  email: string;
  role: Rol;
  isActive: 0 | 1;
  password: string;
}>;

const BASE = "/api/users";

/* ======================================
   🔐 Autenticación (para AuthProvider)
   ====================================== */
// Usa apiFetch SIN token y SIN redirigir en 401.
// Devuelve { ok: false } en cualquier error para evitar HTML crudo.
export async function validateCredentials(email: string, password: string) {
  const endpoints = ["/api/auth/login", "/api/users/login"]; // intenta ambas por compatibilidad

  for (const url of endpoints) {
    try {
      const res = await apiFetch<{ token?: string; user?: { id: number; name?: string; email: string; role: Rol } }>(url, {
        method: "POST",
        json: { email, password },
        withAuth: false,            // no adjuntar Bearer
        suppress401Redirect: true,  // no redirigir en 401
      });

      if (res?.user) {
        return {
          ok: true,
          user: res.user,
          token: res.token,
        };
      }
    } catch {
      // intenta el siguiente endpoint
    }
  }

  // Si llegamos aquí, credenciales inválidas o error → ok:false
  return { ok: false } as {
    ok: false;
    user?: undefined;
    token?: undefined;
  };
}

/* ======================================
   👥 CRUD de usuarios (requiere token)
   ====================================== */

export const listUsers = async (): Promise<UserRow[]> =>
  apiFetch<UserRow[]>(BASE, { cache: "no-store" });

export const createUser = async (u: NewUser) =>
  apiFetch<{ ok: true; id: number }>(BASE, {
    method: "POST",
    json: u,
  });

export const updateUser = async (id: number, patch: UserPatch) =>
  apiFetch<{ ok: true }>(`${BASE}/${id}`, {
    method: "PUT",
    json: patch,
  });

export const deleteUser = async (id: number) =>
  apiFetch<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" });

export const resetPassword = async (id: number, newPassword: string) =>
  apiFetch<{ ok: true }>(`${BASE}/${id}/reset`, {
    method: "POST",
    json: { newPassword },
  });

/** Alias para compatibilidad */
export const getUsers = listUsers;
