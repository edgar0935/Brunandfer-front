// src/pages/Vehiculos.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FaFilePdf, FaFileExcel, FaPrint, FaEdit, FaTrash, FaPlus, FaSearch, FaTruck, FaWrench
} from 'react-icons/fa'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Modal from '@/components/Modal'
import { useAuth } from '@/auth/AuthProvider'   // 👈 actor
import '@/styles/maintenance.css'

import { logMovement } from '@/services/activity'
import {
  listVehicles,
  upsertVehiculo,
  deleteVehiculo,
  nextVehiculoId,
  type Vehiculo,
  type EstadoVehiculo
} from '@/services/vehicles'

import {
  listMantenimientos,
  addMantenimiento,
  deleteMantenimiento,
  newMantenimientoId,
  type Mantenimiento
} from '@/services/maintenance'

const MySwal = withReactContent(Swal)

type VehiculoEditable = {
  id: number
  nombre: string
  placa: string
  marca: string
  motor: string
  modelo: string
  numeroSerie: string
  estado: EstadoVehiculo
  kilometraje: string
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const byId = (a:Vehiculo,b:Vehiculo)=>a.id-b.id

export default function Vehiculos(){
  const { user } = useAuth()
  const canDelete = user?.role === 'admin'
  const actor = useMemo(() => ({
    id: (user as any)?.id,
    name: user?.name ?? user?.email ?? 'Invitado',
    email: user?.email,
    role: user?.role,
  }), [user])

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [vehiculoActual, setVehiculoActual] = useState<VehiculoEditable | null>(null)
  const nombreRef = useRef<HTMLInputElement | null>(null)

  // Bitácora
  const [modalBitacoraOpen, setModalBitacoraOpen] = useState(false)
  const [vehiculoBitacora, setVehiculoBitacora] = useState<Vehiculo | null>(null)
  const [bitacora, setBitacora] = useState<Mantenimiento[]>([])
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Partial<Mantenimiento>>({})

  useEffect(()=>{ listVehicles().then(setVehiculos) }, [])

  const vehiculosFiltrados = useMemo(()=>{
    const q = normalize(busqueda.trim())
    const src = [...vehiculos].sort(byId)
    if (!q) return src
    return src.filter(v =>
      normalize(v.nombre).includes(q) ||
      normalize(v.placa).includes(q) ||
      normalize(v.marca ?? '').includes(q) ||
      normalize(v.modelo ?? '').includes(q) ||
      normalize(v.numeroSerie ?? '').includes(q) ||
      String(v.id).startsWith(q)
    )
  }, [vehiculos, busqueda])

  /* ===== Exportar / Imprimir listado ===== */
  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Flota de Vehículos', 14, 22)
    const body = vehiculosFiltrados.map(v => [
      String(v.id), v.nombre, v.placa, v.marca ?? '', v.motor ?? '', v.modelo ?? ''
    ])
    autoTable(doc, {
      head: [['ID','VEHÍCULO','PLACAS','MARCA','MOTOR','MODELO']],
      body, startY: 30, styles: { fontSize: 10 }, headStyles: { fillColor: [199, 0, 0] }
    })
    doc.save('vehiculos.pdf')
  }

  const exportExcel = () => {
    const wsData = [
      ['ID','VEHÍCULO','PLACAS','MARCA','MOTOR','MODELO'],
      ...vehiculosFiltrados.map(v => [v.id, v.nombre, v.placa, v.marca ?? '', v.motor ?? '', v.modelo ?? ''])
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Vehículos')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'vehiculos.xlsx')
  }

  const imprimir = () => {
    const w = window.open('','','width=1200,height=800'); if(!w) return
    const filas = vehiculosFiltrados.map(v =>
      `<tr><td>${v.id}</td><td>${v.nombre}</td><td>${v.placa}</td><td>${v.marca ?? ''}</td><td>${v.motor ?? ''}</td><td>${v.modelo ?? ''}</td></tr>`
    ).join('')
    w.document.write(`
      <html><head><title>Imprimir Vehículos</title>
      <style>
        body{font-family:system-ui;padding:1rem;color:#222}
        table{width:100%;border-collapse:collapse;margin-top:1rem}
        th,td{border:1px solid #ccc;padding:.5rem;text-align:left}
        th{background:#c70000;color:#fff;text-transform:uppercase}
        tr:nth-child(even){background:#f9f9f9}
        h2{color:#c70000}
        @page{size:auto;margin:12mm}
      </style></head>
      <body>
        <h2>Flota de Vehículos</h2>
        <table>
          <thead><tr><th>ID</th><th>Vehículo</th><th>Placa</th><th>Marca</th><th>Motor</th><th>Modelo</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </body></html>`)
    w.document.close(); w.focus(); w.print(); w.close()
  }

  /* ===== Bitácora ===== */
  async function abrirBitacora(v: Vehiculo) {
    setVehiculoBitacora(v)
    setBitacora(await listMantenimientos(v.id))
    setShowForm(false)
    setDraft({})
    setModalBitacoraOpen(true)
  }

  async function guardarMantenimiento() {
    if (!vehiculoBitacora) return;

    const fechaISO = (draft.fechaISO || '').toString();
    const servicio = (draft.servicio || '').toString().trim();
    const km = Number((draft.kilometraje as any) ?? 0);
    const lugar = (draft.lugar || '').toString().trim();
    const importe = Number((draft.importe as any) ?? 0);
    const notas = (draft.notas || '').toString();

    if (!fechaISO) { await MySwal.fire({icon:'error',title:'Revisa los datos',text:'La fecha es obligatoria.',confirmButtonColor:'#c70000'}); return; }
    if (!servicio) { await MySwal.fire({icon:'error',title:'Revisa los datos',text:'El servicio es obligatorio.',confirmButtonColor:'#c70000'}); return; }
    if (!Number.isFinite(km) || km < 0 || km > 10_000_000) { await MySwal.fire({icon:'error',title:'Revisa los datos',text:'Kilometraje inválido.',confirmButtonColor:'#c70000'}); return; }
    if (!Number.isFinite(importe) || importe < 0 || importe > 100_000_000) { await MySwal.fire({icon:'error',title:'Revisa los datos',text:'Importe inválido.',confirmButtonColor:'#c70000'}); return; }

    const entry: Mantenimiento = {
      id: newMantenimientoId(),
      vehiculoId: vehiculoBitacora.id,
      fechaISO, servicio, kilometraje: km, lugar, importe, notas
    };

    await addMantenimiento(entry);
    setBitacora(await listMantenimientos(vehiculoBitacora.id));
    setShowForm(false);
    setDraft({});

    await logMovement({
      type: 'update',
      entity: 'vehiculo',
      entityId: vehiculoBitacora.id,
      entityName: vehiculoBitacora.nombre,
      description: `Agregó mantenimiento “${servicio}” a “${vehiculoBitacora.nombre}” (km ${km.toLocaleString()})`,
      timestamp: new Date().toISOString(),
      actor,           // ✅ quién lo hizo
      user: actor.name // compatibilidad
    });

    await MySwal.fire({icon:'success',title:'Guardado',text:'Mantenimiento agregado a la bitácora.',confirmButtonColor:'#c70000'});
  }

  function imprimirFicha() {
    if (!vehiculoBitacora) return
    const v = vehiculoBitacora
    const filas = bitacora.map(b => `
      <tr>
        <td>${new Date(b.fechaISO).toLocaleDateString()}</td>
        <td>${b.servicio}</td>
        <td>${b.kilometraje.toLocaleString()}</td>
        <td>${b.lugar || ''}</td>
        <td>${b.importe.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>${b.notas || ''}</td>
      </tr>
    `).join('')
    const w = window.open('','','width=1200,height=800'); if(!w) return
    w.document.write(`
      <html><head><title>Bitácora - ${v.nombre}</title>
      <meta charset="utf-8"/>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:20px;color:#222}
        h2{color:#c70000;margin:0 0 12px 0;text-align:center}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;margin:12px 0 16px 0}
        .label{color:#8b0000}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:.55rem;text-align:left}
        th{background:#c70000;color:#fff;text-transform:uppercase}
        tr:nth-child(even){background:#f9f9f9}
        @page{size:auto;margin:12mm}
      </style></head>
      <body>
        <h2>Bitácora - ${v.nombre}</h2>
        <div class="grid">
          <div><span class="label">Vehículo:</span> ${v.nombre}</div>
          <div><span class="label">Placas:</span> ${v.placa}</div>
          <div><span class="label">Marca:</span> ${v.marca}</div>
          <div><span class="label">Motor:</span> ${v.motor}</div>
          <div><span class="label">Modelo:</span> ${v.modelo}</div>
          <div><span class="label">Número de serie:</span> ${v.numeroSerie || '—'}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>FECHA</th><th>SERVICIO</th><th>KILOMETRAJE</th><th>LUGAR</th><th>IMPORTE</th><th>NOTAS</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </body></html>
    `)
    w.document.close(); w.focus(); w.print(); w.close()
  }

  // Métricas
  const total = vehiculos.length
  const visibles = vehiculosFiltrados.length

  return (
    <div className="page resource-page">
      {/* Header */}
      <div className="resource-header">
        <h1 className="resource-title">
          <FaTruck className="icon" /> Vehículos
        </h1>
        <span className="resource-meta">
          {busqueda ? `Coincidencias: ${visibles}/${total}` : `Total: ${total.toLocaleString()}`}
        </span>
      </div>

      {/* Acciones */}
      <div className="resource-actions">
        <button className="btn" onClick={exportPDF}><FaFilePdf/> Exportar PDF</button>
        <button className="btn" onClick={exportExcel}><FaFileExcel/> Exportar Excel</button>
        <button className="btn" onClick={imprimir}><FaPrint/> Imprimir</button>
      </div>

      {/* Búsqueda */}
      <div className="resource-search">
        <FaSearch className="search-icon"/>
        <input
          type="text"
          placeholder="Buscar por vehículo, placas, marca, modelo, número de serie o ID…"
          value={busqueda}
          onChange={(e)=>setBusqueda(e.target.value)}
          aria-label="Buscar en vehículos"
        />
      </div>

      {/* Tabla (scroll + header rojo como Inventario) */}
      <div
        className="resource-table table-wrapper"
        style={{ height: '60vh', overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}
      >
        <table className="inv-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vehículo</th>
              <th>Placa</th>
              <th>Marca</th>
              <th>Motor</th>
              <th>Modelo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculosFiltrados.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{v.nombre}</td>
                <td>{v.placa}</td>
                <td style={{ textTransform:'uppercase' }}>{v.marca}</td>
                <td>{v.motor}</td>
                <td>{v.modelo}</td>
                <td>
                  {/* Bitácora */}
                  <button
                    className="btn-accion editar"
                    title="Bitácora de mantenimientos"
                    onClick={()=>abrirBitacora(v)}
                    aria-label={`Bitácora ${v.placa}`}
                    style={{ marginRight: 6 }}
                  >
                    <FaWrench />
                  </button>

                  {/* Editar */}
                  <button
                    className="btn-accion editar"
                    onClick={()=>{
                      setVehiculoActual({
                        id: v.id, nombre: v.nombre, placa: v.placa,
                        marca: v.marca ?? '', motor: v.motor ?? '', modelo: v.modelo ?? '',
                        numeroSerie: v.numeroSerie ?? '',
                        estado: v.estado, kilometraje: String(v.kilometraje ?? 0)
                      })
                      setModalVisible(true)
                      setTimeout(()=>nombreRef.current?.focus(),0)
                    }}
                    aria-label={`Editar ${v.placa}`}
                  >
                    <FaEdit/>
                  </button>

                  {/* Eliminar: solo admin */}
                  {canDelete && (
                    <button
                      className="btn-accion eliminar"
                      onClick={async ()=>{
                        if (!canDelete) return
                        const ask = await MySwal.fire({
                          title:'¿Eliminar vehículo?',
                          icon:'warning',
                          showCancelButton:true,
                          confirmButtonText:'Eliminar',
                          confirmButtonColor:'#c70000'
                        })
                        if (!ask.isConfirmed) return
                        await deleteVehiculo(v.id)
                        setVehiculos(await listVehicles())

                        await logMovement({
                          type:'delete',
                          entity:'vehiculo',
                          entityId:v.id,
                          entityName: v.nombre,
                          description:`Eliminó vehículo ${v.placa} (${v.nombre})`,
                          timestamp:new Date().toISOString(),
                          actor,
                          user: actor.name,
                        })

                        await MySwal.fire({icon:'success', title:'Eliminado', text:'Vehículo eliminado.', confirmButtonColor:'#c70000'})
                      }}
                      aria-label={`Eliminar ${v.placa}`}
                    >
                      <FaTrash/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {vehiculosFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="resource-empty">
                  No hay vehículos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FAB agregar */}
      <button
        className="boton-flotante"
        title="Agregar vehículo"
        onClick={()=>{
          const id = nextVehiculoId()
          setVehiculoActual({ id, nombre:'', placa:'', marca:'', motor:'', modelo:'', numeroSerie:'', estado:'activo', kilometraje:'0' })
          setModalVisible(true)
          setTimeout(()=>nombreRef.current?.focus(),0)
        }}
      >
        <FaPlus className="icono-plus" />
      </button>

      {/* Modal ficha vehículo */}
      {modalVisible && vehiculoActual && (
        <Modal
          isOpen={modalVisible}
          title={vehiculos.some(v=>v.id===vehiculoActual.id)?'Actualizar vehículo':'Agregar vehículo'}
          onClose={()=>{ setModalVisible(false); setVehiculoActual(null) }}
          initialFocusRef={nombreRef as React.RefObject<HTMLInputElement>}
        >
          <label htmlFor="nombre">Vehículo / Modelo:</label>
          <input id="nombre" ref={nombreRef} type="text" value={vehiculoActual.nombre}
                 onChange={(e)=>setVehiculoActual({ ...vehiculoActual, nombre:e.target.value })} />

          <label htmlFor="placa">Placas:</label>
          <input id="placa" type="text" value={vehiculoActual.placa}
                 onChange={(e)=>setVehiculoActual({ ...vehiculoActual, placa: e.target.value.toUpperCase() })}
                 style={{ textTransform:'uppercase' }} />

          <label htmlFor="marca">Marca:</label>
          <input id="marca" type="text" value={vehiculoActual.marca}
                 onChange={(e)=>setVehiculoActual({ ...vehiculoActual, marca: e.target.value.toUpperCase() })}
                 style={{ textTransform:'uppercase' }} />

          <label htmlFor="motor">Motor:</label>
          <input id="motor" type="text" placeholder="Ej. 2.4, 1.6T" value={vehiculoActual.motor}
                 onChange={(e)=>setVehiculoActual({ ...vehiculoActual, motor: e.target.value })} />

          <label htmlFor="modelo">Modelo (año):</label>
          <input id="modelo" type="text" inputMode="numeric" pattern="\\d{4}" placeholder="2023" value={vehiculoActual.modelo}
                 onChange={(e)=>setVehiculoActual({ ...vehiculoActual, modelo: e.target.value })} />

          <label htmlFor="serie">Número de serie (VIN):</label>
          <input id="serie" type="text" value={vehiculoActual.numeroSerie}
                 onChange={(e)=>setVehiculoActual({ ...vehiculoActual, numeroSerie: e.target.value.toUpperCase() })}
                 style={{ textTransform:'uppercase' }} />

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={async () => {
              if (!vehiculoActual) return
              const nombre = vehiculoActual.nombre.trim()
              const placa  = vehiculoActual.placa.trim().toUpperCase()
              const marca  = vehiculoActual.marca.trim().toUpperCase()
              const motor  = vehiculoActual.motor.trim()
              const modelo = vehiculoActual.modelo.trim()
              const numeroSerie = vehiculoActual.numeroSerie.trim().toUpperCase()
              const estado = vehiculoActual.estado
              const km     = Number(vehiculoActual.kilometraje)

              if (!nombre) { await MySwal.fire({icon:'error',title:'Error',text:'El vehículo es obligatorio.',confirmButtonColor:'#c70000'}); return }
              if (!placa)  { await MySwal.fire({icon:'error',title:'Error',text:'Las placas son obligatorias.',confirmButtonColor:'#c70000'}); return }
              if (!marca)  { await MySwal.fire({icon:'error',title:'Error',text:'La marca es obligatoria.',confirmButtonColor:'#c70000'}); return }
              if (!modelo) { await MySwal.fire({icon:'error',title:'Error',text:'El modelo (año) es obligatorio.',confirmButtonColor:'#c70000'}); return }
              if (!numeroSerie) { await MySwal.fire({icon:'error',title:'Error',text:'El número de serie es obligatorio.',confirmButtonColor:'#c70000'}); return }

              const payload: Vehiculo = {
                id: vehiculoActual.id, nombre, placa, marca, motor, modelo, numeroSerie, estado, kilometraje: km
              }
              const exists = vehiculos.some(v => v.id === vehiculoActual.id)

              if (exists) {
                const ok = await MySwal.fire({
                  title:'¿Actualizar vehículo?', icon:'question', showCancelButton:true,
                  confirmButtonText:'Actualizar', confirmButtonColor:'#c70000'
                })
                if (!ok.isConfirmed) return
                await upsertVehiculo(payload)

                await logMovement({
                  type:'update',
                  entity:'vehiculo',
                  entityId:payload.id,
                  entityName: payload.nombre,
                  description:`Actualizó vehículo “${placa}” (${nombre})`,
                  timestamp:new Date().toISOString(),
                  actor,
                  user: actor.name,
                })

                await MySwal.fire({icon:'success',title:'Actualizado',text:'Vehículo actualizado.',confirmButtonColor:'#c70000'})
              } else {
                await upsertVehiculo(payload)

                await logMovement({
                  type:'create',
                  entity:'vehiculo',
                  entityId:payload.id,
                  entityName: payload.nombre,
                  description:`Agregó vehículo “${placa}” (${nombre})`,
                  timestamp:new Date().toISOString(),
                  actor,
                  user: actor.name,
                })

                await MySwal.fire({icon:'success',title:'Agregado',text:'Vehículo agregado.',confirmButtonColor:'#c70000'})
              }

              setVehiculos(await listVehicles())
              setModalVisible(false); setVehiculoActual(null)
            }}>Guardar</button>
            <button className="btn-ghost" onClick={()=>{ setModalVisible(false); setVehiculoActual(null) }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Modal Bitácora de Mantenimientos */}
      {modalBitacoraOpen && vehiculoBitacora && (
        <Modal
          isOpen={modalBitacoraOpen}
          title={`Bitácora - ${vehiculoBitacora.nombre}`}
          onClose={()=>setModalBitacoraOpen(false)}
        >
          <div className="bitacora-header">
            <div><span className="label">Vehículo:</span> {vehiculoBitacora.nombre}</div>
            <div><span className="label">Placas:</span> {vehiculoBitacora.placa}</div>
            <div><span className="label">Marca:</span> {vehiculoBitacora.marca}</div>
            <div><span className="label">Motor:</span> {vehiculoBitacora.motor}</div>
            <div><span className="label">Modelo:</span> {vehiculoBitacora.modelo}</div>
            <div><span className="label">Número de serie:</span> {vehiculoBitacora.numeroSerie || '—'}</div>
          </div>

          <div className="bitacora-toolbar">
            <button className="btn-primary" onClick={()=>setShowForm(true)}>Nuevo mantenimiento</button>
            <button className="btn" onClick={imprimirFicha}><FaPrint/> Imprimir ficha</button>
          </div>

          <div
            className="resource-table table-wrapper"
            style={{ height: '50vh', overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}
          >
            <table className="bitacora-table">
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>SERVICIO</th>
                  <th>KILOMETRAJE</th>
                  <th>LUGAR</th>
                  <th>IMPORTE</th>
                  <th>NOTAS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bitacora.map(b => (
                  <tr key={b.id}>
                    <td>{new Date(b.fechaISO).toLocaleDateString()}</td>
                    <td style={{ textTransform:'uppercase' }}>{b.servicio}</td>
                    <td>{b.kilometraje.toLocaleString()}</td>
                    <td>{b.lugar}</td>
                    <td>{b.importe.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td>{b.notas}</td>
                    <td>
                      {canDelete && (
                        <button
                          className="btn-accion eliminar"
                          onClick={async ()=>{
                            if (!canDelete) return
                            const ask = await MySwal.fire({
                              title:'¿Eliminar este registro?',
                              icon:'warning',
                              showCancelButton:true,
                              confirmButtonText:'Eliminar',
                              confirmButtonColor:'#c70000'
                            })
                            if (!ask.isConfirmed || !vehiculoBitacora) return;

                            await deleteMantenimiento(vehiculoBitacora.id, b.id);
                            setBitacora(await listMantenimientos(vehiculoBitacora.id));

                            await logMovement({
                              type: 'update',
                              entity: 'vehiculo',
                              entityId: vehiculoBitacora.id,
                              entityName: vehiculoBitacora.nombre,
                              description: `Eliminó mantenimiento “${b.servicio}” de “${vehiculoBitacora.nombre}” (${new Date(b.fechaISO).toLocaleDateString()})`,
                              timestamp: new Date().toISOString(),
                              actor,
                              user: actor.name,
                            });

                            await MySwal.fire({icon:'success', title:'Eliminado', text:'El registro fue eliminado.', confirmButtonColor:'#c70000'});
                          }}
                          aria-label="Eliminar registro de mantenimiento"
                        >
                          <FaTrash/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {bitacora.length === 0 && (
                  <tr>
                    <td colSpan={7} className="bitacora-empty">Sin registros de mantenimiento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showForm && vehiculoBitacora && (
            <Modal
              isOpen={showForm}
              title={`Nuevo mantenimiento — ${vehiculoBitacora.nombre}`}
              onClose={() => { setShowForm(false); setDraft({}); }}
              initialFocusRef={undefined}
              actions={
                <div className="btn-row">
                  <button className="btn-primary" onClick={guardarMantenimiento}>
                    Agregar
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => { setShowForm(false); setDraft({}); }}
                  >
                    Cancelar
                  </button>
                </div>
              }
            >
              <div className="form-mantenimiento" style={{ marginTop: 6 }}>
                <label style={{ fontWeight: 600 }}>Fecha</label>
                <input
                  type="date"
                  value={(draft.fechaISO as string) || ''}
                  onChange={(e) => setDraft(d => ({ ...d, fechaISO: e.target.value }))}
                  placeholder="dd/mm/aaaa"
                />

                <label style={{ fontWeight: 600 }}>Servicio</label>
                <input
                  type="text"
                  placeholder="Tipo de servicio"
                  value={(draft.servicio as string) || ''}
                  onChange={(e) => setDraft(d => ({ ...d, servicio: e.target.value }))}
                />

                <label style={{ fontWeight: 600 }}>Kilometraje</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Kilometraje"
                  value={(draft.kilometraje as any) ?? ''}
                  onChange={(e) =>
                    setDraft(d => ({ ...d, kilometraje: e.target.value.replace(',', '.') as any }))
                  }
                />

                <label style={{ fontWeight: 600 }}>Lugar</label>
                <input
                  type="text"
                  placeholder="Donde se realizó"
                  value={(draft.lugar as string) || ''}
                  onChange={(e) => setDraft(d => ({ ...d, lugar: e.target.value }))}
                />

                <label style={{ fontWeight: 600 }}>Importe</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Importe"
                  value={(draft.importe as any) ?? ''}
                  onChange={(e) =>
                    setDraft(d => ({ ...d, importe: e.target.value.replace(',', '.') as any }))
                  }
                />

                <label style={{ fontWeight: 600 }}>Notas</label>
                <input
                  type="text"
                  placeholder="Notas"
                  value={(draft.notas as string) || ''}
                  onChange={(e) => setDraft(d => ({ ...d, notas: e.target.value }))}
                />
              </div>
            </Modal>
          )}
        </Modal>
      )}
    </div>
  )
}
