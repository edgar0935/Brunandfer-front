// src/services/localdb.ts
const NAMESPACE = 'constructora-app'

function key(name: string) {
  return `${NAMESPACE}:${name}`
}

export function readJSON<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name))
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON<T>(name: string, value: T): void {
  localStorage.setItem(key(name), JSON.stringify(value))
}

export function ensureSeed() {
  // Solo si no existe inventario/movimientos en localStorage
  const hasInv = localStorage.getItem(key('inventory'))
  const hasMov = localStorage.getItem(key('movements'))

  if (!hasInv) {
    const base = ['Clavos','Cemento','Madera','Pintura','Arena','Tubería','Cable','Martillo','Taladro','Ladrillo']
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      nombre: `${base[i % base.length]} ${i + 1}`,
      cantidad: Math.floor(Math.random() * 1000),
    }))
    writeJSON('inventory', rows)
  }

  if (!hasMov) {
    const now = Date.now()
    const seed = [
      { id: 'm3', type: 'delete', entity: 'articulo', entityId: '27', description: 'Eliminó artículo “Ladrillo 27”', timestamp: new Date(now - 1000 * 60 * 30).toISOString(), user: 'edgar' },
      { id: 'm2', type: 'update', entity: 'articulo', entityId: '5',  description: 'Actualizó cantidad de “Cemento 5” a 240', timestamp: new Date(now - 1000 * 60 * 55).toISOString(), user: 'edgar' },
      { id: 'm1', type: 'create', entity: 'articulo', entityId: '41', description: 'Agregó “Martillo 41” (12 uds.)', timestamp: new Date(now - 1000 * 60 * 90).toISOString(), user: 'edgar' },
    ]
    writeJSON('movements', seed)
  }
}

export function resetLocalDB() {
  localStorage.removeItem(key('inventory'))
  localStorage.removeItem(key('movements'))
  ensureSeed()
}
