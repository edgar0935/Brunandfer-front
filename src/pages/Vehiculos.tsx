// src/pages/Vehiculos.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaFilePdf,
  FaFileExcel,
  FaPrint,
  FaEdit,
  FaTrash,
  FaPlus,
  FaSearch,
  FaTruck,
  FaWrench,
  FaRegCalendarAlt,
} from "react-icons/fa";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Modal from "@/components/Modal";
import { useAuth } from "@/auth/AuthProvider";
import "@/styles/maintenance.css";

import { logMovement } from "@/services/activity";
import {
  listVehicles,
  upsertVehiculo,
  deleteVehiculo,
  type Vehiculo,
  type EstadoVehiculo,
} from "@/services/vehicles";

import {
  listMantenimientos,
  addMantenimiento,
  deleteMantenimiento,
  newMantenimientoId,
  type Mantenimiento,
} from "@/services/maintenance";

/** MySwal unificado (sin zIndex para evitar warnings en toasts) */
const MySwal = withReactContent(
  Swal.mixin({
    heightAuto: false,
    backdrop: true,
  })
);

type VehiculoEditable = {
  /** id: 0 = nuevo (creación). >0 = existente (edición) */
  id: number;
  nombre: string;
  placa: string;
  marca: string;
  motor: string;
  modelo: string;
  numeroSerie: string;
  estado: EstadoVehiculo;
  kilometraje: string; // input
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const byId = (a: Vehiculo, b: Vehiculo) => a.id - b.id;

/** Opciones de motivo de baja */
const MOTIVOS_BAJA = [
  "Robo",
  "Venta",
  "Descompostura irrecuperable",
  "Siniestrado",
  "Donación",
  "Otro",
] as const;
type MotivoBaja = (typeof MOTIVOS_BAJA)[number];

export default function Vehiculos() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin";
  const actor = useMemo(
    () => ({
      id: (user as any)?.id,
      name: user?.name ?? user?.email ?? "Invitado",
      email: user?.email,
      role: user?.role,
    }),
    [user]
  );

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [vehiculoActual, setVehiculoActual] = useState<VehiculoEditable | null>(null);
  const nombreRef = useRef<HTMLInputElement | null>(null);

  // Bitácora
  const [modalBitacoraOpen, setModalBitacoraOpen] = useState(false);
  const [vehiculoBitacora, setVehiculoBitacora] = useState<Vehiculo | null>(null);
  const [bitacora, setBitacora] = useState<Mantenimiento[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Partial<Mantenimiento>>({});

  // Modal Dar de baja (eliminar) con motivo
  const [bajaOpen, setBajaOpen] = useState(false);
  const [bajaTarget, setBajaTarget] = useState<Vehiculo | null>(null);
  const [bajaMotivo, setBajaMotivo] = useState<MotivoBaja | "">("");
  const [bajaDetalle, setBajaDetalle] = useState("");
  const [bajaConfirm, setBajaConfirm] = useState(false);
  const detalleMin = 10;
  const detalleMax = 240;

  useEffect(() => {
    listVehicles().then(setVehiculos);
  }, []);

  const vehiculosFiltrados = useMemo(() => {
    const q = normalize(busqueda.trim());
    const src = [...vehiculos].sort(byId);
    if (!q) return src;
    return src.filter(
      (v) =>
        normalize(v.nombre).includes(q) ||
        normalize(v.placa).includes(q) ||
        normalize(v.marca ?? "").includes(q) ||
        normalize(v.modelo ?? "").includes(q) ||
        normalize(v.numeroSerie ?? "").includes(q)
      // 👆 se quita el filtro por ID
    );
  }, [vehiculos, busqueda]);

  /* ===== Exportar / Imprimir listado ===== */
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relación General de Vehiculos", 14, 22);
    const body = vehiculosFiltrados.map((v) => [
      v.nombre,
      v.placa,
      v.marca ?? "",
      v.motor ?? "",
      v.modelo ?? "",
    ]);
    autoTable(doc, {
      head: [["VEHÍCULO", "PLACAS", "MARCA", "MOTOR", "MODELO"]], // 🔻 sin ID
      body,
      startY: 30,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [199, 0, 0] },
    });
    doc.save("vehiculos.pdf");
  };

  const exportExcel = () => {
    const wsData = [
      ["VEHÍCULO", "PLACAS", "MARCA", "MOTOR", "MODELO"], // 🔻 sin ID
      ...vehiculosFiltrados.map((v) => [
        v.nombre,
        v.placa,
        v.marca ?? "",
        v.motor ?? "",
        v.modelo ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehículos");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "vehiculos.xlsx");
  };

  const imprimir = () => {
    const w = window.open("", "", "width=1200,height=800");
    if (!w) return;
    const filas = vehiculosFiltrados
      .map(
        (v) =>
          `<tr><td>${v.nombre}</td><td>${v.placa}</td><td>${v.marca ?? ""}</td><td>${
            v.numeroSerie ?? ""
          }</td><td>${v.modelo ?? ""}</td></tr>`
      )
      .join("");
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
        <h2>Relacion General de Vehículos</h2>
        <table>
          <thead><tr><th>Vehículo</th><th>Placa</th><th>Marca</th><th>No. Serie</th><th>Modelo</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.onafterprint = () => {
    w.close();
  };
  };

  /* ===== Bitácora ===== */
  async function abrirBitacora(v: Vehiculo) {
    setVehiculoBitacora(v);
    setBitacora(await listMantenimientos(v.id));
    setShowForm(false);
    setDraft({});
    setModalBitacoraOpen(true);
  }

  async function guardarMantenimiento() {
    if (!vehiculoBitacora) return;

    const fechaISO = (draft.fechaISO || "").toString();
    const servicio = (draft.servicio || "").toString().trim();
    const km = Number((draft.kilometraje as any) ?? 0);
    const lugar = (draft.lugar || "").toString().trim();
    const importe = Number((draft.importe as any) ?? 0);
    const notas = (draft.notas || "").toString();

    if (!fechaISO) {
      await MySwal.fire({
        icon: "error",
        title: "Revisa los datos",
        text: "La fecha es obligatoria.",
        confirmButtonColor: "#c70000",
      });
      return;
    }
    if (!servicio) {
      await MySwal.fire({
        icon: "error",
        title: "Revisa los datos",
        text: "El servicio es obligatorio.",
        confirmButtonColor: "#c70000",
      });
      return;
    }
    if (!Number.isFinite(km) || km < 0 || km > 10_000_000) {
      await MySwal.fire({
        icon: "error",
        title: "Revisa los datos",
        text: "Kilometraje inválido.",
        confirmButtonColor: "#c70000",
      });
      return;
    }
    if (!Number.isFinite(importe) || importe < 0 || importe > 100_000_000) {
      await MySwal.fire({
        icon: "error",
        title: "Revisa los datos",
        text: "Importe inválido.",
        confirmButtonColor: "#c70000",
      });
      return;
    }

    const entry: Mantenimiento = {
      id: newMantenimientoId(),
      vehiculoId: vehiculoBitacora.id,
      fechaISO,
      servicio,
      kilometraje: km,
      lugar,
      importe,
      notas,
    };

    await addMantenimiento(entry);
    setBitacora(await listMantenimientos(vehiculoBitacora.id));
    setShowForm(false);
    setDraft({});

    await MySwal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Mantenimiento agregado",
      showConfirmButton: false,
      timer: 2000,
    });
  }

  function imprimirFicha() {
    if (!vehiculoBitacora) return;
    const v = vehiculoBitacora;
    const filas = bitacora
  .map(
    (b) => `
      <tr>
        <td>${dayjs(b.fechaISO).format("DD/MM/YYYY")}</td>
        <td>${b.servicio}</td>
        <td>${b.kilometraje.toLocaleString()}</td>
        <td>${b.lugar || ""}</td>
        <td>${b.importe.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>${b.notas || ""}</td>
      </tr>
    `
  )
  .join("");

    const w = window.open("", "", "width=1200,height=800");
    if (!w) return;
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
          <div><span class="label">Número de serie:</span> ${v.numeroSerie || "—"}</div>
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
    `);
    w.document.close();
    w.focus();
    w.print();
    w.onafterprint = () => {
    w.close();
  };
  }

  /* ===== Lógica Dar de baja (eliminar) ===== */
  function abrirBaja(v: Vehiculo) {
    setBajaTarget(v);
    setBajaMotivo("");
    setBajaDetalle("");
    setBajaConfirm(false);
    setBajaOpen(true);
  }

  const bajaDetalleRequerido = bajaMotivo === "Otro";
  const bajaDetalleInvalido =
    bajaDetalleRequerido && bajaDetalle.trim().length < detalleMin;

  async function confirmarBaja() {
    if (!bajaTarget) return;
    if (!bajaMotivo) return;
    if (bajaDetalleInvalido) return;
    if (!bajaConfirm) return;

    await deleteVehiculo(bajaTarget.id);
    setVehiculos(await listVehicles());

    const desc =
      bajaMotivo === "Otro" && bajaDetalle.trim()
        ? `Eliminó vehículo ${bajaTarget.placa} (${bajaTarget.nombre}). Motivo: ${bajaMotivo}. Detalle: ${bajaDetalle.trim()}`
        : `Eliminó vehículo ${bajaTarget.placa} (${bajaTarget.nombre}). Motivo: ${bajaMotivo}`;

    await logMovement({
      type: "delete",
      entity: "vehiculo",
      entityId: bajaTarget.id,
      entityName: bajaTarget.nombre,
      description: desc,
      timestamp: new Date().toISOString(),
      actor,
      user: actor.name,
    });

    setBajaOpen(false);
    setBajaTarget(null);
    await MySwal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Vehículo eliminado",
      showConfirmButton: false,
      timer: 2000,
    });
  }

  const total = vehiculos.length;
  const visibles = vehiculosFiltrados.length;

  // flags visuales del modal de baja
  const errors = {
    motivo: !bajaMotivo,
    detalle: bajaDetalleInvalido,
    confirm: !bajaConfirm,
  };

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
        <button className="btn" onClick={exportPDF}>
          <FaFilePdf /> Exportar PDF
        </button>
        <button className="btn" onClick={exportExcel}>
          <FaFileExcel /> Exportar Excel
        </button>
        <button className="btn" onClick={imprimir}>
          <FaPrint /> Imprimir
        </button>
      </div>

      {/* Búsqueda */}
      <div className="resource-search">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Buscar por vehículo, placas, marca, modelo o número de serie…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar en vehículos"
        />
      </div>

      {/* Tabla */}
      <div
        className="resource-table table-wrapper"
        style={{ height: "60vh", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
      >
        <table className="inv-table">
          <thead>
            <tr>
              {/* 🔻 sin columna ID */}
              <th>Vehículo</th>
              <th>Placa</th>
              <th>Marca</th>
              <th>Motor</th>
              <th>Modelo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculosFiltrados.map((v) => (
              <tr key={v.id}>
                {/* 🔻 sin <td> del ID */}
                <td>{v.nombre}</td>
                <td>{v.placa}</td>
                <td style={{ textTransform: "uppercase" }}>{v.marca}</td>
                <td>{v.motor}</td>
                <td>{v.modelo}</td>
                <td>
                  {/* Bitácora */}
                  <button
                    className="btn-accion editar"
                    title="Bitácora de mantenimientos"
                    onClick={() => abrirBitacora(v)}
                    aria-label={`Bitácora ${v.placa}`}
                    style={{ marginRight: 6 }}
                  >
                    <FaWrench />
                  </button>

                  {/* Editar */}
                  <button
                    className="btn-accion editar"
                    onClick={() => {
                      setVehiculoActual({
                        id: v.id,
                        nombre: v.nombre,
                        placa: v.placa,
                        marca: v.marca ?? "",
                        motor: v.motor ?? "",
                        modelo: v.modelo ?? "",
                        numeroSerie: v.numeroSerie ?? "",
                        estado: v.estado,
                        kilometraje: String(v.kilometraje ?? 0),
                      });
                      setModalVisible(true);
                      setTimeout(() => nombreRef.current?.focus(), 0);
                    }}
                    aria-label={`Editar ${v.placa}`}
                  >
                    <FaEdit />
                  </button>

                  {/* Eliminar: solo admin */}
                  {canDelete && (
                    <button
                      className="btn-accion eliminar"
                      onClick={() => abrirBaja(v)}
                      aria-label={`Eliminar ${v.placa}`}
                    >
                      <FaTrash />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {vehiculosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="resource-empty">
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
        onClick={() => {
          // id = 0 => creación (el backend generará el id)
          setVehiculoActual({
            id: 0,
            nombre: "",
            placa: "",
            marca: "",
            motor: "",
            modelo: "",
            numeroSerie: "",
            estado: "activo",
            kilometraje: "0",
          });
          setModalVisible(true);
          setTimeout(() => nombreRef.current?.focus(), 0);
        }}
      >
        <FaPlus className="icono-plus" />
      </button>

      {/* Modal ficha vehículo */}
      {modalVisible && vehiculoActual && (
        <Modal
          isOpen={modalVisible}
          title={vehiculoActual.id > 0 ? "Actualizar vehículo" : "Agregar vehículo"}
          onClose={() => {
            setModalVisible(false);
            setVehiculoActual(null);
          }}
          initialFocusRef={nombreRef as React.RefObject<HTMLInputElement>}
          actions={
            <>
              <button
  className="btn-primary"
  onClick={async () => {
    if (!vehiculoActual) return;
    const nombre = vehiculoActual.nombre.trim();
    const placa = vehiculoActual.placa.trim().toUpperCase();
    const marca = vehiculoActual.marca.trim().toUpperCase();
    const motor = vehiculoActual.motor.trim();
    const modelo = vehiculoActual.modelo.trim();
    const numeroSerie = vehiculoActual.numeroSerie.trim().toUpperCase();
    const estado = vehiculoActual.estado;
    const km = Number(vehiculoActual.kilometraje);

    // Validaciones rápidas
    const required = [
      { ok: !!nombre, msg: "El vehículo / modelo es obligatorio." },
      { ok: !!placa, msg: "Las placas son obligatorias." },
      { ok: !!marca, msg: "La marca es obligatoria." },
      { ok: !!modelo, msg: "El modelo (año) es obligatorio." },
      { ok: !!numeroSerie, msg: "El número de serie (VIN) es obligatorio." },
    ];
    const firstError = required.find((r) => !r.ok);
    if (firstError) {
      await MySwal.fire({
        icon: "error",
        title: "Revisa los datos",
        text: firstError.msg,
        confirmButtonColor: "#c70000",
      });
      return;
    }

    const payload: any = {
      id: vehiculoActual.id || 0,
      nombre,
      placa,
      marca,
      motor,
      modelo,
      numeroSerie,
      estado,
      kilometraje: km,
    };

    const isUpdate = vehiculoActual.id > 0;

    if (isUpdate) {
      const ok = await MySwal.fire({
        title: "¿Actualizar vehículo?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Actualizar",
        confirmButtonColor: "#c70000",
      });
      if (!ok.isConfirmed) return;
    }

    try {
  await upsertVehiculo(payload);

  await MySwal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: isUpdate ? "Vehículo actualizado" : "Vehículo agregado",
    showConfirmButton: false,
    timer: 2000,
  });

  setVehiculos(await listVehicles());
  setModalVisible(false);
  setVehiculoActual(null);

} catch (err: any) {
  const status = err.response?.status;
  const errorMsg = err.response?.data?.message;

  await MySwal.fire({
    icon: "error",
    title: status === 409 ? "Placa duplicada" : "Error",
    text: errorMsg || "No se puede Registrar el vehículo, placa duplicada.",
    confirmButtonColor: "#c70000",
  });
}
  }}
>
  Guardar
</button>

<button
  className="btn-ghost"
  onClick={() => {
    setModalVisible(false);
    setVehiculoActual(null);
  }}
>
  Cancelar
</button>
            </>
          }
        >
          {/* === Formulario === */}
          <div className="veh-form">
            <div className="veh-form__item veh-form__item--full">
              <label className="veh-form__label" htmlFor="veh_nombre">
                Vehículo / Modelo
              </label>
              <input
                id="veh_nombre"
                ref={nombreRef}
                type="text"
                className="veh-form__input"
                placeholder="Ej. NP300, Hilux, Civic, etc."
                value={vehiculoActual.nombre}
                onChange={(e) =>
                  setVehiculoActual({ ...vehiculoActual, nombre: e.target.value })
                }
              />
            </div>

            <div className="veh-form__item">
              <label className="veh-form__label" htmlFor="veh_placa">
                Placas
              </label>
              <input
                id="veh_placa"
                type="text"
                className="veh-form__input"
                value={vehiculoActual.placa}
                onChange={(e) =>
                  setVehiculoActual({
                    ...vehiculoActual,
                    placa: e.target.value.toUpperCase(),
                  })
                }
                style={{ textTransform: "uppercase" }}
                placeholder="ABC-123-A"
              />
            </div>

            <div className="veh-form__item">
              <label className="veh-form__label" htmlFor="veh_marca">
                Marca
              </label>
              <input
                id="veh_marca"
                type="text"
                className="veh-form__input"
                value={vehiculoActual.marca}
                onChange={(e) =>
                  setVehiculoActual({
                    ...vehiculoActual,
                    marca: e.target.value.toUpperCase(),
                  })
                }
                style={{ textTransform: "uppercase" }}
                placeholder="NISSAN, TOYOTA…"
              />
            </div>

            <div className="veh-form__item">
              <label className="veh-form__label" htmlFor="veh_motor">
                Motor
              </label>
              <input
                id="veh_motor"
                type="text"
                className="veh-form__input"
                placeholder="Ej. 2.4, 1.6T"
                value={vehiculoActual.motor}
                onChange={(e) =>
                  setVehiculoActual({ ...vehiculoActual, motor: e.target.value })
                }
              />
            </div>

            <div className="veh-form__item">
              <label className="veh-form__label" htmlFor="veh_modelo">
                Modelo (año)
              </label>
              <input
                id="veh_modelo"
                type="text"
                className="veh-form__input"
                inputMode="numeric"
                pattern="\\d{4}"
                placeholder="2023"
                value={vehiculoActual.modelo}
                onChange={(e) =>
                  setVehiculoActual({ ...vehiculoActual, modelo: e.target.value })
                }
              />
            </div>

            <div className="veh-form__item veh-form__item--full">
              <label className="veh-form__label" htmlFor="veh_vin">
                Número de serie (VIN)
              </label>
              <input
                id="veh_vin"
                type="text"
                className="veh-form__input"
                value={vehiculoActual.numeroSerie}
                onChange={(e) =>
                  setVehiculoActual({
                    ...vehiculoActual,
                    numeroSerie: e.target.value.toUpperCase(),
                  })
                }
                style={{ textTransform: "uppercase" }}
                placeholder="17 caracteres"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Bitácora de Mantenimientos */}
      {modalBitacoraOpen && vehiculoBitacora && (
        <Modal
          isOpen={modalBitacoraOpen}
          title={`Bitácora - ${vehiculoBitacora.nombre}`}
          onClose={() => setModalBitacoraOpen(false)}
        >
          <div className="bitacora-header">
            <div>
              <span className="label">Vehículo:</span> {vehiculoBitacora.nombre}
            </div>
            <div>
              <span className="label">Placas:</span> {vehiculoBitacora.placa}
            </div>
            <div>
              <span className="label">Marca:</span> {vehiculoBitacora.marca}
            </div>
            <div>
              <span className="label">Motor:</span> {vehiculoBitacora.motor}
            </div>
            <div>
              <span className="label">Modelo:</span> {vehiculoBitacora.modelo}
            </div>
            <div>
              <span className="label">Número de serie:</span>{" "}
              {vehiculoBitacora.numeroSerie || "—"}
            </div>
          </div>

          <div className="bitacora-toolbar">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              Nuevo mantenimiento
            </button>
            <button className="btn" onClick={imprimirFicha}>
              <FaPrint /> Imprimir ficha
            </button>
          </div>

          <div
            className="resource-table table-wrapper"
            style={{ height: "50vh", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
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
    {bitacora.map((b, index) => (
      <tr key={b.id || `no-id-${index}`}>
        {/* Aquí usamos dayjs para formatear la fecha */}
        <td>{dayjs(b.fechaISO).format("DD/MM/YYYY")}</td>
        <td style={{ textTransform: "uppercase" }}>{b.servicio}</td>
        <td>{b.kilometraje.toLocaleString()}</td>
        <td>{b.lugar}</td>
        <td>
          {b.importe.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
        <td>{b.notas}</td>
        <td>
          {canDelete && (
            <button
  className="btn-accion eliminar"
  disabled={!b.id}
  title={!b.id ? "Registro con ID inválido; corrige/actualiza estos datos" : "Eliminar"}
  onClick={async () => {
    if (!canDelete || !vehiculoBitacora || !b.id) return;
    const ask = await MySwal.fire({
      title: "¿Eliminar este registro?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      confirmButtonColor: "#c70000",
    });
    if (!ask.isConfirmed) return;

    await deleteMantenimiento(vehiculoBitacora.id, b.id);
    setBitacora(await listMantenimientos(vehiculoBitacora.id));

    await MySwal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Registro eliminado",
      showConfirmButton: false,
      timer: 2000,
    });
  }}
  aria-label="Eliminar registro de mantenimiento"
>
  <FaTrash />
</button>

          )}
        </td>
      </tr>
    ))}
    {bitacora.length === 0 && (
      <tr>
        <td colSpan={7} className="bitacora-empty">
          Sin registros de mantenimiento.
        </td>
      </tr>
    )}
  </tbody>
</table>

          </div>

          {showForm && vehiculoBitacora && (
            <Modal
              isOpen={showForm}
              title={`Nuevo mantenimiento — ${vehiculoBitacora.nombre}`}
              onClose={() => {
                setShowForm(false);
                setDraft({});
              }}
              actions={
                <div className="btn-row">
                  <button className="btn-primary" onClick={guardarMantenimiento}>
                    Agregar
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setShowForm(false);
                      setDraft({});
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              }
            >
              <div className="mnt-form">
                {/* Fecha */}
                <div className="mnt-item">
                  <label className="mnt-label">Fecha</label>
                  <div className="mnt-input-icon">
                    <input
  type="date"
  className="mnt-input"
  value={(draft.fechaISO as string) || ""}
  onChange={(e) => setDraft((d) => ({ ...d, fechaISO: e.target.value }))}
  placeholder="dd/mm/aaaa"
/>
                    <span className="calendar-icon" aria-hidden="true">
                      <FaRegCalendarAlt />
                    </span>
                  </div>
                </div>

                {/* Servicio */}
                <div className="mnt-item">
                  <label className="mnt-label">Servicio</label>
                  <input
                    type="text"
                    className="mnt-input"
                    placeholder="Tipo de servicio"
                    value={(draft.servicio as string) || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, servicio: e.target.value }))}
                  />
                </div>

                {/* Kilometraje */}
                <div className="mnt-item">
                  <label className="mnt-label">Kilometraje</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="mnt-input"
                    placeholder="Kilometraje"
                    value={(draft.kilometraje as any) ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, kilometraje: e.target.value.replace(",", ".") as any }))
                    }
                  />
                </div>

                {/* Importe */}
                <div className="mnt-item">
                  <label className="mnt-label">Importe</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="mnt-input"
                    placeholder="Importe"
                    value={(draft.importe as any) ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, importe: e.target.value.replace(",", ".") as any }))
                    }
                  />
                </div>

                {/* Lugar (full) */}
                <div className="mnt-item mnt-item--full">
                  <label className="mnt-label">Lugar</label>
                  <input
                    type="text"
                    className="mnt-input"
                    placeholder="Dónde se realizó"
                    value={(draft.lugar as string) || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, lugar: e.target.value }))}
                  />
                </div>

                {/* Notas (full) */}
                <div className="mnt-item mnt-item--full">
                  <label className="mnt-label">Notas</label>
                  <textarea
                    className="mnt-textarea"
                    placeholder="Notas"
                    rows={3}
                    value={(draft.notas as string) || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
                  />
                </div>
              </div>
            </Modal>
          )}
        </Modal>
      )}

      {/* Modal DAR DE BAJA (Eliminar con motivo) */}
      {bajaOpen && bajaTarget && (
        <Modal
          isOpen={bajaOpen}
          title="Dar de baja vehículo"
          onClose={() => setBajaOpen(false)}
          actions={
            <div className="btn-row">
              <button
                className="btn-primary"
                disabled={!bajaMotivo || bajaDetalleInvalido || !bajaConfirm}
                onClick={confirmarBaja}
              >
                Eliminar
              </button>
              <button className="btn-ghost" onClick={() => setBajaOpen(false)}>
                Cancelar
              </button>
            </div>
          }
        >
          {/* ====== NUEVO DISEÑO ====== */}
          <div className="veh-baja">
            {/* Header */}
            <div className="veh-baja__header">
              <div className="veh-baja__icon">!</div>
              <div>
                <h3 className="veh-baja__title">Dar de baja vehículo</h3>
                <p className="veh-baja__subtitle">
                  Esta acción eliminará el registro de forma permanente.
                </p>
              </div>
            </div>

            {/* Ficha */}
            <div className="veh-baja__info">
              <div className="veh-baja__row">
                <span className="label">Placas:</span>
                <span className="value">{bajaTarget.placa}</span>
              </div>
              <div className="veh-baja__row">
                <span className="label">Vehículo:</span>
                <span className="value">{bajaTarget.nombre}</span>
              </div>
              <div className="veh-baja__row">
                <span className="label">Marca:</span>
                <span className="value">{bajaTarget.marca}</span>
              </div>
              <div className="veh-baja__row">
                <span className="label">Modelo:</span>
                <span className="value">{bajaTarget.modelo}</span>
              </div>
            </div>

            {/* Motivo */}
            <div className="veh-baja__group">
              <label className="veh-baja__label">Motivo de baja</label>
              <select
                className={`veh-baja__select ${!bajaMotivo ? "is-invalid" : ""}`}
                value={bajaMotivo}
                onChange={(e) => setBajaMotivo(e.target.value as MotivoBaja | "")}
              >
                <option value="">— Selecciona —</option>
                {MOTIVOS_BAJA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {!bajaMotivo && <div className="veh-baja__error">Selecciona un motivo.</div>}
            </div>

            {/* Detalle */}
            <div className="veh-baja__group">
              <div className="veh-baja__label">
                Detalle <span className="veh-baja__help">(requerido si eliges “Otro”)</span>
              </div>
              <textarea
                className={`veh-baja__textarea ${bajaDetalleInvalido ? "is-invalid" : ""}`}
                placeholder="Escribe un detalle breve: folio, acta, comprador, póliza, etc. (máx. 240 caracteres)"
                maxLength={detalleMax}
                value={bajaDetalle}
                onChange={(e) => setBajaDetalle(e.target.value)}
              />
              <div className="veh-baja__counter">
                {bajaDetalle.length}/{detalleMax}
              </div>
              {bajaDetalleInvalido && (
                <div className="veh-baja__error">
                  Escribe al menos {detalleMin} caracteres cuando el motivo sea “Otro”.
                </div>
              )}
            </div>

            {/* Confirmación */}
            <div className="veh-baja__confirm">
              <input
                id="confirm-baja"
                type="checkbox"
                checked={bajaConfirm}
                onChange={(e) => setBajaConfirm(e.target.checked)}
              />
              <label htmlFor="confirm-baja">Entiendo que esta acción no se puede deshacer.</label>
            </div>
            {!bajaConfirm && (
              <div className="veh-baja__error">Debes confirmar para continuar.</div>
            )}
          </div>
          {/* ====== /NUEVO DISEÑO ====== */}
        </Modal>
      )}
    </div>
  );
}
