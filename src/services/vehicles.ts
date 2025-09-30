// src/services/vehicles.ts
export type EstadoVehiculo = 'activo' | 'mantenimiento' | 'baja';

export type Vehiculo = {
  id: number;
  nombre: string;      // Vehículo / modelo
  placa: string;       // Placas
  marca: string;
  motor: string;
  modelo: string;      // año como string (p. ej. "2023")
  numeroSerie: string; // ← NUEVO (VIN / número de serie)
  estado: EstadoVehiculo;
  kilometraje: number;
};

const STORAGE_KEY = 'vehiculos';

const withDefaults = (v: any): Vehiculo => ({
  id: v.id,
  nombre: v.nombre ?? '',
  placa: v.placa ?? '',
  marca: v.marca ?? '',
  motor: v.motor ?? '',
  modelo: v.modelo ?? '',
  numeroSerie: v.numeroSerie ?? '', // ← NUEVO
  estado: (v.estado ?? 'activo') as EstadoVehiculo,
  kilometraje: Number.isFinite(v.kilometraje) ? v.kilometraje : 0,
});

export async function listVehicles(): Promise<Vehiculo[]> {
  const raw = localStorage.getItem(STORAGE_KEY);
  const arr = raw ? JSON.parse(raw) : [];
  return arr.map(withDefaults);
}

export async function upsertVehiculo(v: Vehiculo) {
  const data = await listVehicles();
  const idx = data.findIndex(x => x.id === v.id);
  const clean = withDefaults(v);
  if (idx >= 0) data[idx] = clean; else data.push(clean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function deleteVehiculo(id: number) {
  const data = await listVehicles();
  const filtered = data.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function nextVehiculoId(): number {
  return Math.floor(Date.now() / 1000);
}
