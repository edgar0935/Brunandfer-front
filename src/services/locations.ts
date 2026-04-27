// src/services/locations.ts
import { apiFetch } from "@/utils/api";

// El backend devuelve array de nombres (string[])
const BASE = "/api/locations";

const STORAGE_KEY = "ubicaciones_inventario";
const SEED = ["Taller", "Obra A", "Obra B", "Bodega", "Oficina"];

// --- Helpers de storage (fallback local) ---
function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.every((x: any) => typeof x === "string")
      ? arr
      : SEED;
  } catch {
    return SEED;
  }
}
function writeLocal(list: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// --- API real (con token) ---
async function listAPI(): Promise<string[]> {
  return apiFetch<string[]>(BASE, { cache: "no-store" });
}

async function createAPI(name: string): Promise<void> {
  await apiFetch(`${BASE}`, {
    method: "POST",
    json: { name },
  });
}

async function deleteAPIByName(name: string): Promise<void> {
  await apiFetch(`${BASE}/by-name/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

// --- API del servicio consumida por los componentes ---
export async function listLocationNames(): Promise<string[]> {
  try {
    const names = await listAPI();     // intenta backend
    writeLocal(names);                 // cachea localmente
    return names;
  } catch {
    // sin backend o sin sesión → usa cache/local
    const list = readLocal();
    writeLocal(list);
    return list;
  }
}

export async function addLocationName(name: string): Promise<string[]> {
  const clean = name.trim();
  if (!clean) return listLocationNames();

  try {
    await createAPI(clean);            // crea en backend (requiere token)
    return await listLocationNames();  // refresca desde backend
  } catch {
    // fallback local si no hay backend o 401
    const current = readLocal();
    const next = Array.from(new Set([...current, clean])).sort((a, b) => a.localeCompare(b));
    writeLocal(next);
    return next;
  }
}

export async function removeLocationByName(name: string): Promise<string[]> {
  const clean = name.trim();
  if (!clean) return listLocationNames();

  try {
    await deleteAPIByName(clean);      // borra en backend (requiere token)
    return await listLocationNames();  // refresca desde backend
  } catch {
    // fallback local si no hay backend o 401
    const target = clean.toLowerCase();
    const current = readLocal();
    const next = current.filter((x) => x.toLowerCase() !== target);
    writeLocal(next);
    return next;
  }
}
