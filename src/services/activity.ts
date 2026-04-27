// src/services/activity.ts
import { apiFetch } from "@/utils/api";

/** Tipos de movimiento que devuelve el backend */
export type MovementType = "create" | "update" | "delete";

/** Modelo usado por la UI */
export interface Movement {
  id: string;
  type: MovementType;
  entity: "articulo" | "obra" | "vehiculo" | string;
  entityId?: string | number;
  entityName?: string;
  description: string;
  timestamp: string; // ISO
  actor?: { name: string; email?: string; role?: string };
  user?: string; // compatibilidad con movimientos antiguos
}

const API_BASE = "/api";

/* -------------------------------------------
   Utilidades
------------------------------------------- */
function cleanDesc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[¿?]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* -------------------------------------------
   Mapear fila de BD → modelo de frontend
------------------------------------------- */
type DbMovement = {
  id: number | string;
  type: MovementType;
  entity: string;
  entity_id: number | string | null;
  entity_name: string | null;
  description: string;
  ts: string; // ISO/Date string
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
};

function mapDb(m: DbMovement): Movement {
  return {
    id: String(m.id),
    type: m.type,
    entity: m.entity,
    entityId: m.entity_id ?? undefined,
    entityName: m.entity_name ?? undefined,
    description: cleanDesc(m.description),
    timestamp: new Date(m.ts).toISOString(),
    actor: m.actor_name
      ? { name: m.actor_name, email: m.actor_email ?? undefined, role: m.actor_role ?? undefined }
      : undefined,
    user: m.actor_name ?? undefined, // <--- agregado
  };
}

/* -------------------------------------------
   API PÚBLICA (SIN mock, SIN caché local)
------------------------------------------- */

/** Obtiene movimientos recientes desde el backend. */
export async function getRecentMovements(limit = 10): Promise<Movement[]> {
  try {
    const rows = await apiFetch<DbMovement[]>(
      `${API_BASE}/movements?limit=${limit}`,
      { cache: "no-store", suppress401Redirect: true }
    );
    if (!Array.isArray(rows)) return [];
    return rows.map(mapDb);
  } catch {
    return [];
  }
}

/** Registra un movimiento en el backend. */
export async function logMovement(
  m: Omit<Movement, "id" | "timestamp"> & { timestamp?: string }
): Promise<void> {
  const desc = cleanDesc(m.description);

  await apiFetch(`${API_BASE}/movements`, {
    method: "POST",
    json: {
      type: m.type,
      entity: m.entity,
      entityId: m.entityId ?? null,
      entityName: m.entityName ?? null,
      description: desc,
      timestamp: m.timestamp || new Date().toISOString(),
      actor: m.actor ?? null,
      user: m.user ?? null, // <--- agregado
    },
    suppress401Redirect: true,
  });
}

/** Etiqueta bonita para el tipo de movimiento */
export function movementLabel(type: MovementType) {
  switch (type) {
    case "create":
      return { text: "Creación", tone: "ok" as const };
    case "update":
      return { text: "Actualización", tone: "info" as const };
    case "delete":
      return { text: "Eliminación", tone: "danger" as const };
  }
}
