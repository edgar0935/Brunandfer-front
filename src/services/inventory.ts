// src/services/inventory.ts
import { apiFetch } from "@/utils/api";

export type Articulo = {
  id: number;
  nombre: string;
  cantidad: number;
  ubicacion?: string;
};

const API = "/api/inventory";

export async function listInventory(): Promise<Articulo[]> {
  return apiFetch<Articulo[]>(API, { cache: "no-store", suppress401Redirect: true });
}

/** Crear artículo (NO enviar id; el backend lo asigna) */
export async function createArticulo(input: Omit<Articulo, "id">): Promise<Articulo> {
  return apiFetch<Articulo>(API, {
    method: "POST",
    json: input,
    suppress401Redirect: true,
  });
}

/** Actualizar artículo existente */
export async function updateArticulo(
  id: number,
  patch: Partial<Omit<Articulo, "id">>
): Promise<Articulo> {
  return apiFetch<Articulo>(`${API}/${id}`, {
    method: "PUT",
    json: patch,
    suppress401Redirect: true,
  });
}

/** Eliminar artículo */
export async function deleteArticulo(id: number): Promise<void> {
  await apiFetch(`${API}/${id}`, { method: "DELETE", suppress401Redirect: true });
}
