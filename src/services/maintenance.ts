// src/services/maintenance.ts
export type Mantenimiento = {
  id: string;            // uuid
  vehiculoId: number;    // relación al vehículo
  fechaISO: string;      // YYYY-MM-DD
  servicio: string;
  kilometraje: number;
  lugar: string;
  importe: number;
  notas: string;
};

const STORAGE_KEY = 'vehiculos_mantenimiento';

function readAll(): Record<string, Mantenimiento[]> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
}
function writeAll(db: Record<string, Mantenimiento[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export async function listMantenimientos(vehiculoId: number): Promise<Mantenimiento[]> {
  const db = readAll();
  return (db[String(vehiculoId)] || []).sort(
    (a, b) => new Date(a.fechaISO).getTime() - new Date(b.fechaISO).getTime()
  );
}

export async function addMantenimiento(entry: Mantenimiento): Promise<void> {
  const db = readAll();
  const key = String(entry.vehiculoId);
  const list = db[key] || [];
  const idx = list.findIndex(e => e.id === entry.id);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  db[key] = list;
  writeAll(db);
}

export async function deleteMantenimiento(vehiculoId: number, id: string): Promise<void> {
  const db = readAll();
  const key = String(vehiculoId);
  db[key] = (db[key] || []).filter(e => e.id !== id);
  writeAll(db);
}

export function newMantenimientoId(): string {
  return (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}
