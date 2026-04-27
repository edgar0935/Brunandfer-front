// src/pages/History.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  getRecentMovements,
  movementLabel,
  type Movement,
} from '@/services/activity'
import {
  FaPlus, FaEdit, FaTrash, FaFilePdf, FaFileExcel, FaHistory, FaUser,
  FaChevronLeft, FaChevronRight
} from 'react-icons/fa'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useAuth } from '@/auth/AuthProvider'
import './History.css'
type TypeFilter = 'all' | 'create' | 'update' | 'delete'

function displayName(m: Movement): string {
  if (m.entityName && m.entityName.trim()) return m.entityName.trim()
  const desc = (m.description || '').toString()
  const fancy = desc.match(/“([^”]+)”/); if (fancy?.[1]) return fancy[1].trim()
  const plain = desc.match(/"([^"]+)"/); if (plain?.[1]) return plain[1].trim()
  if (m.entityId != null) {
    if ((m.entity || '').toLowerCase() === 'articulo') return `artículo #${m.entityId}`
    return `${m.entity} #${m.entityId}`
  }
  return m.entity || '—'
}

function displayActor(m: Movement): { name: string; email?: string } {
  const name = (m.actor?.name || m.user || '').trim()
  const email = (m.actor?.email || '').trim() || undefined
  return { name: name || 'Sistema', email }
}

export default function History() {
  const { user } = useAuth()
  const me = { name: user?.name ?? user?.email ?? '', email: user?.email ?? '' }

  const [rows, setRows] = useState<Movement[]>([])
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>(''); const [endDate, setEndDate] = useState<string>('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Carga inicial (sin suscripción onActivityChange)
  useEffect(() => {
    getRecentMovements(500).then(data => {
      setRows(Array.isArray(data) ? data : [])
    }).catch(() => setRows([]))
  }, [])

  const entities = useMemo(() => Array.from(new Set(rows.map(r => r.entity))).sort(), [rows])

  const filtered = useMemo(() => {
    const start = startDate ? new Date(startDate + 'T00:00:00') : null
    const end   = endDate   ? new Date(endDate   + 'T23:59:59.999') : null
    const list = rows.filter(m => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false
      if (entityFilter !== 'all' && m.entity !== entityFilter) return false

      if (onlyMine) {
        const a = displayActor(m)
        const mine =
          (!!me.email && a.email && a.email.toLowerCase() === me.email.toLowerCase()) ||
          (!!me.name && a.name.toLowerCase() === me.name.toLowerCase())
        if (!mine) return false
      }

      const t = new Date(m.timestamp).getTime()
      if (start && t < start.getTime()) return false
      if (end && t > end.getTime()) return false
      return true
    })
    setPage(1)
    return list.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
  }, [rows, typeFilter, entityFilter, startDate, endDate, onlyMine, me.email, me.name])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Historial de Movimientos', 14, 22)
    const body = filtered.map(m => {
      const a = displayActor(m)
      return [
        new Date(m.timestamp).toLocaleString(),
        movementLabel(m.type).text,
        displayName(m),
        m.description || '',
        a.email ? `${a.name} <${a.email}>` : a.name,
      ]
    })
    autoTable(doc, {
      head: [['FECHA/HORA', 'TIPO', 'ENTIDAD', 'DESCRIPCIÓN', 'USUARIO']],
      body, startY: 30, styles: { fontSize: 10, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [199, 0, 0] },
    })
    doc.save('historial.pdf')
  }

  const exportExcel = () => {
    const wsData = [
      ['FECHA/HORA', 'TIPO', 'ENTIDAD', 'DESCRIPCIÓN', 'USUARIO'],
      ...filtered.map(m => {
        const a = displayActor(m)
        return [
          new Date(m.timestamp).toLocaleString(),
          movementLabel(m.type).text,
          displayName(m),
          m.description || '',
          a.email ? `${a.name} <${a.email}>` : a.name,
        ]
      })
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Historial')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'historial.xlsx')
  }

  return (
    <div className="page resource-page history-page">
      <div className="resource-header">
        <h1 className="resource-title"><FaHistory className="icon" /> Historial de Movimientos</h1>
        <span className="resource-meta">{filtered.length} registros</span>
      </div>

      <div className="resource-actions">
        <button className="btn" onClick={exportPDF}><FaFilePdf /> Exportar PDF</button>
        <button className="btn" onClick={exportExcel}><FaFileExcel /> Exportar Excel</button>
      </div>

      {/* Filtros */}
      <div className="filters-row">
        <div className="filter">
          <label>Tipo</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">Todos</option>
            <option value="create">Altas</option>
            <option value="update">Actualizaciones</option>
            <option value="delete">Eliminaciones</option>
          </select>
        </div>
        <div className="filter">
          <label>Entidad</label>
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
            <option value="all">Todas</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="filter">
          <label>Desde</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="filter">
          <label>Hasta</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <label className="filter only-mine" style={{ cursor:'pointer' }}>
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
          <FaUser style={{ opacity:.7 }} />
          <span>Solo mis acciones</span>
        </label>
      </div>

      {/* Tabla */}
      <div className="resource-table table-wrapper">
        <table className="inv-table history-table">
          <thead>
            <tr>
              <th>FECHA/HORA</th>
              <th>TIPO</th>
              <th>ENTIDAD</th>
              <th>DESCRIPCIÓN</th>
              <th>USUARIO</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(m => {
              const label = movementLabel(m.type)
              const icon = m.type === 'create' ? <FaPlus/> : m.type === 'update' ? <FaEdit/> : <FaTrash/>
              const a = displayActor(m)
              const isMe =
                (!!me.email && a.email && a.email.toLowerCase() === me.email.toLowerCase()) ||
                (!!me.name && a.name.toLowerCase() === me.name.toLowerCase())

              return (
                <tr key={m.id}>
                  <td>{new Date(m.timestamp).toLocaleString()}</td>
                  <td>
                    <span className={`chip chip--${label.tone}`} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      {icon} {label.text}
                    </span>
                  </td>
                  <td>{displayName(m)}</td>
                  <td>{m.description}</td>
                  <td>
                    {a.name}
                    {isMe && <span className="me-tag"> (tú)</span>}
                    {a.email && <div style={{ color:'var(--ink-3)', fontSize:12 }}>{a.email}</div>}
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="history-empty">No hay movimientos que coincidan con los filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {filtered.length > pageSize && (
        <div className="history-pagination">
          <button
            className="btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <FaChevronLeft style={{ marginRight: 6 }} /> Anterior
          </button>

          <span className="page-info">Página {page} de {totalPages}</span>

          <button
            className="btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Página siguiente"
            title="Página siguiente"
          >
            Siguiente <FaChevronRight style={{ marginLeft: 6 }} />
          </button>
        </div>
      )}
    </div>
  )
}
