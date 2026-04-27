// src/services/maintenance.ts
import { apiFetch } from "@/utils/api";

export type Mantenimiento = {
  id: string;           // uuid
  vehiculoId: number;
  fechaISO: string;     // YYYY-MM-DD
  servicio: string;
  kilometraje: number;
  lugar: string;
  importe: number;
  notas: string;
};

const BASE = "/api/maintenance";

/** 
 * Convierte el mantenimiento al formato que el backend espera (snake_case).
 */
// src/services/maintenance.ts
function toApi(m: Mantenimiento) {
  return {
    vehiculoId: m.vehiculoId,
    fechaISO: m.fechaISO,      // "YYYY-MM-DD" está bien para un date sin hora
    servicio: m.servicio,
    kilometraje: m.kilometraje ?? 0,
    lugar: m.lugar ?? "",
    importe: m.importe ?? 0,
    notas: m.notas ?? "",
  };
}


/** 
 * Convierte los datos del backend (snake_case) a camelCase para el frontend.
 */
function fromApi(a: any): Mantenimiento {
  return {
    id: a.id,
    vehiculoId: a.vehiculo_id,
    fechaISO: a.fechaISO,
    servicio: a.servicio,
    kilometraje: a.kilometraje ?? 0,
    lugar: a.lugar ?? "",
    importe: a.importe ?? 0,
    notas: a.notas ?? "",
  };
}

/** 
 * Genera un id local si se necesita antes de guardar (solo para la UI).
 */
export function newMantenimientoId(): string {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 
 * Lista mantenimientos por vehículo → GET /api/maintenance/:vehiculoId 
 */
export async function listMantenimientos(vehiculoId: number): Promise<Mantenimiento[]> {
  const rows = await apiFetch<any[]>(`${BASE}/${encodeURIComponent(vehiculoId)}`, {
    cache: "no-store",
  });
  return rows.map(fromApi);
}

/** 
 * Crea un mantenimiento → POST /api/maintenance 
 * (⚠️ sin id en la URL, usando snake_case en el body)
 */
export async function addMantenimiento(m: Mantenimiento): Promise<{ ok: true }> {
  if (!m.vehiculoId) throw new Error("Falta vehiculoId");
  if (!m.fechaISO) throw new Error("Falta fechaISO");
  if (!m.servicio?.trim()) throw new Error("Falta servicio");

  await apiFetch<{ ok: true }>(BASE, {
    method: "POST",
    json: toApi(m),
  });

  return { ok: true };
}

/** 
 * Elimina un mantenimiento → DELETE /api/maintenance/:vehiculoId/:id 
 */
export async function deleteMantenimiento(
  vehiculoId: number,
  id: string
): Promise<{ ok: true }> {
  if (!id) throw new Error("ID de mantenimiento vacío");
  await apiFetch(`${BASE}/${encodeURIComponent(vehiculoId)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return { ok: true };
}