// src/services/vehicles.ts
import { apiFetch } from "@/utils/api";

export type EstadoVehiculo = "activo" | "mantenimiento" | "baja";

export type Vehiculo = {
  id: number;
  nombre: string;
  placa: string;
  marca?: string | null;
  motor?: string | null;
  modelo: string;             // ← obligatorio según backend
  numeroSerie: string;        // ← obligatorio según backend
  estado: EstadoVehiculo;
  kilometraje?: number | null;
};

const BASE = "/api/vehicles";

// Mapeo hacia la API (el backend usa camelCase: numeroSerie)
function toApi(v: Partial<Vehiculo>) {
  // normaliza campos opcionales
  const body: any = {
    nombre: v.nombre?.trim(),
    placa: v.placa?.trim(),
    marca: v.marca?.trim?.() ?? v.marca ?? undefined,
    motor: v.motor?.trim?.() ?? v.motor ?? undefined,
    modelo: v.modelo?.trim(),
    numeroSerie: v.numeroSerie?.trim(),    // 👈 camelCase correcto
    estado: v.estado ?? undefined,
  };

  // kilometraje: si no es número finito, no lo mandes
  const km = Number((v.kilometraje as any));
  if (Number.isFinite(km)) body.kilometraje = km;

  return body;
}

export async function listVehicles(): Promise<Vehiculo[]> {
  // El backend ya devuelve numeroSerie en camelCase (por el alias)
  return apiFetch<Vehiculo[]>(BASE, { cache: "no-store" });
}

export async function createVehiculo(v: Vehiculo): Promise<{ ok: true; id: number }> {
  // valida requeridos antes de pegarle al server
  for (const k of ["nombre", "placa", "modelo", "numeroSerie"] as const) {
    if (!v[k] || String(v[k]).trim() === "") throw new Error(`Falta ${k}`);
  }
  return apiFetch<{ ok: true; id: number }>(BASE, {
    method: "POST",
    json: toApi(v),          // 👈 sin "id"; el backend lo genera
  });
}

export async function updateVehiculo(v: Vehiculo): Promise<{ ok: true }> {
  if (!v.id) throw new Error("Falta id");
  // no obligamos todos, pero mandamos en camelCase
  return apiFetch<{ ok: true }>(`${BASE}/${encodeURIComponent(v.id)}`, {
    method: "PUT",
    json: toApi(v),
  });
}

export async function deleteVehiculo(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function upsertVehiculo(v: Vehiculo): Promise<{ ok: true; id?: number }> {
  // decide por existencia local (idealmente por backend, pero dejamos como lo tienes)
  const all = await listVehicles();
  const exists = all.some((x) => x.id === v.id);
  if (exists) {
    await updateVehiculo(v);
    return { ok: true };
  } else {
    const r = await createVehiculo(v);
    return { ok: true, id: r.id };
  }
}
