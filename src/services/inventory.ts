// src/services/inventory.ts
import { readJSON, writeJSON, ensureSeed } from './localdb';

ensureSeed();

export interface Articulo { id: number; nombre: string; cantidad: number }

const KEY = 'inventory';

function listAll(): Articulo[] {
  return readJSON<Articulo[]>(KEY, []);
}

function saveAll(rows: Articulo[]) {
  writeJSON(KEY, rows);
}

export async function listInventory(): Promise<Articulo[]> {
  return listAll().slice().sort((a, b) => a.id - b.id);
}

export async function upsertArticulo(a: Articulo): Promise<void> {
  const rows = listAll();
  const idx = rows.findIndex(r => r.id === a.id);
  if (idx >= 0) rows[idx] = a; else rows.push(a);
  saveAll(rows);
}

export async function deleteArticulo(id: number): Promise<void> {
  const rows = listAll().filter(r => r.id !== id);
  saveAll(rows);
}

export function nextArticuloId(): number {
  const rows = listAll();
  const max = rows.reduce((m, r) => Math.max(m, r.id), 0);
  return max + 1;
}
