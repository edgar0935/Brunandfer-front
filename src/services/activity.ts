// src/services/activity.ts

// Tipos de movimiento
export type MovementType = 'create' | 'update' | 'delete'

export interface Movement {
  id: string
  type: MovementType
  entity: 'articulo' | 'obra' | 'vehiculo' | string
  entityId?: string | number
  /** Nombre legible de la entidad (p.ej., nombre del material) */
  entityName?: string
  description: string
  timestamp: string // ISO
  user?: string // 👈 compatibilidad vieja
  actor?: {       // 👈 nueva estructura recomendada
    name: string
    email?: string
    role?: string
  }
}

const API_BASE = '/api'

// ====== Registro optimista/local ======
const LOCAL_KEY = 'movements_local_cache_v1'
type LocalMovement = Movement

function readLocal(): LocalMovement[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((x) => x && typeof x === 'object' && x.id && x.timestamp)
  } catch {
    return []
  }
}

function writeLocal(list: LocalMovement[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

// Limpia optimistas >24h
function gcLocal() {
  const now = Date.now()
  const keep = readLocal().filter((m) => now - +new Date(m.timestamp) < 24 * 3600 * 1000)
  writeLocal(keep)
}

// ====== Event bus tiempo real ======
type Listener = () => void
const listeners = new Set<Listener>()

function emitChange() {
  listeners.forEach((cb) => { try { cb() } catch {} })
  try { localStorage.setItem('__activity_ping__', String(Date.now())) } catch {}
}

export function onActivityChange(cb: Listener) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

window.addEventListener('storage', (e) => {
  if (e.key === LOCAL_KEY || e.key === '__activity_ping__') {
    emitChange()
  }
})

// ====== API pública ======
export async function getRecentMovements(limit = 10): Promise<Movement[]> {
  gcLocal()

  // 1) remoto
  let remote: Movement[] = []
  try {
    const res = await fetch(`${API_BASE}/movements?limit=${limit}`, { cache: 'no-store' })
    if (res.ok) remote = await res.json()
  } catch {
    // ignora; mock si no hay backend
  }

  // 2) mock si remoto vacío
  if (!remote.length) {
    remote = [
      {
        id: 'm3',
        type: 'delete',
        entity: 'articulo',
        entityId: '27',
        entityName: 'Ladrillo 27',
        description: 'Eliminó artículo “Ladrillo 27”',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        user: 'edgar',
        actor: { name: 'Edgar García', email: 'edgar@example.com', role: 'admin' },
      },
      {
        id: 'm2',
        type: 'update',
        entity: 'articulo',
        entityId: '5',
        entityName: 'Cemento 5',
        description: 'Actualizó cantidad de “Cemento 5” a 240',
        timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
        user: 'edgar',
        actor: { name: 'Edgar García', email: 'edgar@example.com', role: 'admin' },
      },
      {
        id: 'm1',
        type: 'create',
        entity: 'articulo',
        entityId: '41',
        entityName: 'Martillo 41',
        description: 'Agregó “Martillo 41” (12 uds.)',
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        user: 'edgar',
        actor: { name: 'Edgar García', email: 'edgar@example.com', role: 'admin' },
      },
    ]
  }

  // 3) une con optimistas
  const local = readLocal()
  const merged = [...local, ...remote].sort(
    (a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)
  )

  // 4) limita
  return merged.slice(0, limit)
}

/**
 * Registra un movimiento con optimismo:
 * - agrega versión local inmediata (id `tmp-*`)
 * - intenta POST al backend (no bloquea la UI si falla)
 */
export async function logMovement(m: Omit<Movement, 'id'>): Promise<void> {
  const tmp: Movement = {
    id: `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: m.type,
    entity: m.entity,
    entityId: m.entityId,
    entityName: m.entityName,
    description: m.description,
    timestamp: m.timestamp || new Date().toISOString(),
    user: m.user,
    actor: m.actor,
  }
  const current = readLocal()
  writeLocal([tmp, ...current])
  emitChange()

  // POST real
  try {
    await fetch(`${API_BASE}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: m.type,
        entity: m.entity,
        entityId: m.entityId,
        entityName: m.entityName,
        description: m.description,
        timestamp: tmp.timestamp,
        user: m.user,
        actor: m.actor,
      }),
    })
    gcLocal()
    emitChange()
  } catch {
    console.warn('No se pudo registrar movimiento (offline/mock).', m)
  }
}

// Helper visual
export function movementLabel(type: MovementType) {
  switch (type) {
    case 'create': return { text: 'Creación',      tone: 'ok' as const }
    case 'update': return { text: 'Actualización', tone: 'info' as const }
    case 'delete': return { text: 'Eliminación',   tone: 'danger' as const }
  }
}
