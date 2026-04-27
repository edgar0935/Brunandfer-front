import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaFilePdf, FaFileExcel, FaPrint, FaEdit, FaTrash, FaPlus, FaSearch, FaBoxes,
} from "react-icons/fa";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Modal from "@/components/Modal";
import DeleteOnly from "@/auth/DeleteOnly";
import { useAuth } from "@/auth/AuthProvider";

import { exportInventarioPDF, exportInventarioExcel } from "@/utils/export";
import type { Row } from "@/utils/export";

import { addLocationName, removeLocationByName } from "@/services/locations";
import { logMovement } from "@/services/activity";
import {
  listInventory, createArticulo, updateArticulo, deleteArticulo, type Articulo,
} from "@/services/inventory";


const MySwal = withReactContent(Swal.mixin({}));

export type Ubicacion = string;

type ArticuloEditable = {
  id?: number;                 // undefined => nuevo
  nombre: string;
  cantidad: string;
  ubicacion: Ubicacion | "";
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const byIdAsc = (a: Articulo, b: Articulo) => a.id - b.id;

// ✅ Si tu backend ya registra movimientos, pon esto en true para NO duplicar desde el front
const BACKEND_LOGS = true;

export default function Inventario() {
  const [inventario, setInventario] = useState<Articulo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [loadingUbicaciones, setLoadingUbicaciones] = useState(true);
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string>("Todas");

  const [modalVisible, setModalVisible] = useState(false);
  const [articuloActual, setArticuloActual] = useState<ArticuloEditable | null>(null);
  const [saving, setSaving] = useState(false);      // ← evita dobles clics al guardar
  const [busyLoc, setBusyLoc] = useState(false);    // ← evita dobles clics en “Nueva ubicación”

  const nombreRef = useRef<HTMLInputElement | null>(null);

  const { user } = useAuth();
  const actor = useMemo(
    () => ({
      id: (user as any)?.id,
      name: user?.name ?? user?.email ?? "Invitado",
      email: user?.email,
      role: user?.role,
    }),
    [user]
  );

  const isModalAbierto = modalVisible;

  // ===== CARGA INICIAL INVENTARIO
  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await listInventory();
      if (mounted) setInventario(data);
    })();
    return () => { mounted = false; };
  }, []);

  // ===== CARGA UBICACIONES
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetch("/api/locations", { cache: "no-store" });
        if (!resp.ok) throw new Error("No se pudieron cargar ubicaciones");
        const raw = (await resp.json()) as string[];

        const norm = Array.from(
          new Map(
            raw
              .map((s) => (s ?? "").toString().trim())
              .filter(Boolean)
              .map((s) => [s.toLowerCase(), s])
          ).values()
        ).sort((a, b) => a.localeCompare(b));

        if (!alive) return;
        setUbicaciones(norm);
      } catch {
        if (alive) setUbicaciones([]);
      } finally {
        if (alive) setLoadingUbicaciones(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const ubicacionesUniq = useMemo(() => ubicaciones, [ubicaciones]);

  // ===== FILTRO
  const inventarioFiltrado = useMemo(() => {
    const q = normalize(busqueda.trim());
    let data = [...inventario];
    if (q) {
      data = data.filter(
        (a) =>
          normalize(a.nombre).includes(q) ||
          String(a.id).startsWith(q) ||
          normalize((a as any).ubicacion || "").includes(q)
      );
    }
    if (ubicacionFiltro !== "Todas") {
      data = data.filter(
        (a) =>
          ((a as any).ubicacion || "")
            .toString()
            .toLowerCase() === ubicacionFiltro.toLowerCase()
      );
    }
    return data.sort(byIdAsc);
  }, [inventario, busqueda, ubicacionFiltro]);

  const total = inventario.length;
  const visibles = inventarioFiltrado.length;

  // ===== EXPORT / PRINT
  const exportPDF = useCallback(
    () => exportInventarioPDF(inventarioFiltrado as Row[]),
    [inventarioFiltrado]
  );
  const exportExcel = useCallback(
    () => exportInventarioExcel(inventarioFiltrado as Row[]),
    [inventarioFiltrado]
  );
  const imprimir = useCallback(() => {
    const w = window.open("", "", "width=1000,height=800");
    if (!w) return;
    const filas = inventarioFiltrado
      .map((a) => {
        const ub = ((a as any).ubicacion || "").toString().trim();
        const label = ub ? ub : "Sin asignar";
        return `<tr>
          <td>${a.nombre}</td>
          <td>${a.cantidad.toLocaleString()}</td>
          <td>${label}</td>
        </tr>`;
      })
      .join("");
    w.document.write(`
      <html>
      <head>
        <title>Imprimir Inventario</title>
        <meta charset="utf-8"/>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:20px;color:#222}
          h2{color:#c70000;margin:0 0 12px 0}
          table{width:100%;border-collapse:collapse;margin-top:8px}
          th,td{border:1px solid #ccc;padding:.55rem;text-align:left}
          th{background:#c70000;color:#fff;text-transform:uppercase}
          tr:nth-child(even){background:#f9f9f9}
        </style>
      </head>
      <body>
        <h2>Inventario General</h2>
        <table>
          <thead><tr><th>Artículo</th><th>Cantidad</th><th>Ubicación</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </body>
      </html>
    `);
    w.document.close(); w.focus(); 
    w.onafterprint = () => {
    w.close();
  }; w.print();
  }, [inventarioFiltrado]);

  // ===== MODAL
  const abrirModal = useCallback((a: Articulo) => {
    if (isModalAbierto) return;
    setArticuloActual({
      id: a.id,
      nombre: a.nombre,
      cantidad: String(a.cantidad),
      ubicacion: ((a as any).ubicacion as Ubicacion) || "",
    });
    setModalVisible(true);
    setTimeout(() => nombreRef.current?.focus(), 0);
  }, [isModalAbierto]);

  const cerrarModal = useCallback(() => {
    setModalVisible(false);
    setArticuloActual(null);
    setSaving(false);
  }, []);

  // ===== NUEVA UBICACIÓN (con guardas anti-doble click)
  const agregarNuevaUbicacion = useCallback(async () => {
    if (busyLoc) return;
    const { value, isConfirmed } = await MySwal.fire({
      title: "Nueva ubicación",
      input: "text",
      inputLabel: "Escribe el nombre de la ubicación",
      showCancelButton: true,
      confirmButtonText: "Agregar",
      confirmButtonColor: "#c70000",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed || !value) return;

    const nueva = value.toString().trim();
    if (!nueva) return;

    try {
      setBusyLoc(true);
      const next = await addLocationName(nueva);
      setUbicaciones(next);
      setArticuloActual((prev) => (prev ? { ...prev, ubicacion: nueva } : prev));

      if (!BACKEND_LOGS) {
        await logMovement({
          type: "create",
          entity: "ubicacion",
          entityId: nueva,
          entityName: nueva,
          description: `Creó ubicación “${nueva}”`,
          timestamp: new Date().toISOString(),
          actor,
          user: actor.name,
        });
      }

      MySwal.fire({
        toast: true, position: "top-end", icon: "success",
        title: "Ubicación creada", showConfirmButton: false, timer: 2000,
      });
    } finally {
      setBusyLoc(false);
    }
  }, [actor, busyLoc]);

  // ===== ELIMINAR UBICACIÓN
  const eliminarUbicacion = useCallback(async (nombre: string) => {
    const target = (nombre ?? "").toString().trim();
    if (!target) return;
    const { isConfirmed } = await MySwal.fire({
      title: `¿Eliminar ubicación "${target}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      confirmButtonColor: "#c70000",
    });
    if (!isConfirmed) return;

    const next = await removeLocationByName(target);
    setUbicaciones(next);

    setUbicacionFiltro((prev) =>
      prev.trim().toLowerCase() === target.toLowerCase() ? "Todas" : prev
    );

    const afectados = inventario.filter(
      (a) =>
        (((a as any).ubicacion || "") as string).trim().toLowerCase() ===
        target.toLowerCase()
    );

   if (afectados.length > 0) {
  await Promise.all(
    afectados.map(async (a) =>
      updateArticulo(a.id, {
        nombre: a.nombre,
        cantidad: a.cantidad,
        ubicacion: "",        // solo desasignamos la ubicación
      })
    )
  );
  setInventario(await listInventory());
}


    if (!BACKEND_LOGS) {
      await logMovement({
        type: "delete",
        entity: "ubicacion",
        entityId: target,
        entityName: target,
        description:
          afectados.length > 0
            ? `Eliminó ubicación “${target}” y desasignó ${afectados.length} artículo(s)`
            : `Eliminó ubicación “${target}”`,
        timestamp: new Date().toISOString(),
        actor,
        user: actor.name,
      });
    }

    MySwal.fire({
      toast: true, position: "top-end", icon: "success",
      title: "Ubicación eliminada", showConfirmButton: false, timer: 2000,
    });
  }, [inventario, actor]);

  // ===== GUARDAR ARTÍCULO (sin duplicados, sin undefined)
  const guardar = useCallback(async () => {
    if (saving) return;                 
    if (!articuloActual) return;

    const nombre = (articuloActual.nombre || "").trim();
    if (!nombre) {
      MySwal.fire({ icon: "warning", title: "Escribe un nombre válido" });
      return;
    }

    const cantidadNumRaw = Number(
      (articuloActual.cantidad ?? "").toString().replace(",", ".")
    );
    const cantidadNum = Number.isFinite(cantidadNumRaw) ? cantidadNumRaw : 0;

    const ubicacion = (articuloActual.ubicacion || "").trim();
    const isNew = articuloActual.id == null;

    try {
      setSaving(true);

      let saved: Articulo;
      if (isNew) {
        saved = await createArticulo({ nombre, cantidad: cantidadNum, ubicacion });
      } else {
        saved = await updateArticulo(articuloActual.id!, { nombre, cantidad: cantidadNum, ubicacion });
      }

      // Solo loguea desde el front si el backend NO lo hace
      if (!BACKEND_LOGS) {
        await logMovement({
          type: isNew ? "create" : "update",
          entity: "articulo",
          entityId: saved.id,
          entityName: saved.nombre,
          description: isNew
            ? `Agregó artículo “${saved.nombre}” (id ${saved.id})`
            : `Actualizó artículo “${saved.nombre}” (id ${saved.id})`,
          timestamp: new Date().toISOString(),
          actor,
          user: actor.name,
        });
      }

      setInventario(await listInventory());
      cerrarModal();

      MySwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isNew ? "Artículo agregado" : "Artículo actualizado",
        showConfirmButton: false,
        timer: 2000,
      });
    } finally {
      setSaving(false);
    }
  }, [articuloActual, cerrarModal, actor, saving]);

  // ===== ELIMINAR ARTÍCULO
  const eliminar = useCallback(async (id: number) => {
    const { isConfirmed } = await MySwal.fire({
      title: "¿Eliminar artículo?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      confirmButtonColor: "#c70000",
    });
    if (!isConfirmed) return;

    await deleteArticulo(id);
    setInventario(await listInventory());

    if (!BACKEND_LOGS) {
      await logMovement({
        type: "delete",
        entity: "articulo",
        entityId: id,
        description: `Eliminó artículo (id ${id})`,
        timestamp: new Date().toISOString(),
        actor,
        user: actor.name,
      });
    }

    MySwal.fire({
      toast: true, position: "top-end", icon: "success",
      title: "Artículo eliminado", showConfirmButton: false, timer: 2000,
    });
  }, [actor]);

  // ===== RENDER (igual a tu diseño)
  return (
    <div className="page resource-page">
      <div className="resource-header">
        <h1 className="resource-title">
          <FaBoxes className="icon" /> Inventario General
        </h1>
        <span className="resource-meta">
          {busqueda || ubicacionFiltro !== "Todas"
            ? `Coincidencias: ${visibles}/${total}`
            : `Total: ${total.toLocaleString()} ítems`}
        </span>
      </div>

      <div className="resource-actions">
        <button className="btn" onClick={exportPDF}><FaFilePdf /> Exportar PDF</button>
        <button className="btn" onClick={exportExcel}><FaFileExcel /> Exportar Excel</button>
        <button className="btn" onClick={imprimir}><FaPrint /> Imprimir</button>
      </div>

      <div className="resource-search search-with-filters">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Buscar por nombre o ubicación"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="filter-group">
          <label className="filter-label">Ubicación</label>
          <select
            value={ubicacionFiltro}
            onChange={(e) => setUbicacionFiltro(e.target.value)}
          >
            <option key="__todas" value="Todas">Todas</option>
            {loadingUbicaciones ? (
              <option key="__loading" value="" disabled>Cargando…</option>
            ) : (
              ubicacionesUniq.map((u) => <option key={`loc-${u}`} value={u}>{u}</option>)
            )}
          </select>
        </div>
      </div>

      <div
        className="resource-table table-wrapper"
        style={{ height: "60vh", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
      >
        <table className="inv-table" role="table">
          <thead style={{ position: "sticky", top: 0, background: "var(--brand)", color: "#fff", zIndex: 1 }}>
            <tr>
              <th>Artículo</th>
              <th>Cantidad</th>
              <th>Ubicación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inventarioFiltrado.map((a) => {
              const ub = (((a as any).ubicacion || "") as string).trim();
              return (
                <tr key={a.id}>
                  <td>{a.nombre}</td>
                  <td>{a.cantidad.toLocaleString()}</td>
                  <td>{ub || "Sin asignar"}</td>
                  <td>
                    <button
                      className="btn-accion editar"
                      disabled={isModalAbierto}
                      onClick={() => abrirModal(a)}
                    >
                      <FaEdit />
                    </button>

                    <DeleteOnly resource="inventario">
                      <button
                        className="btn-accion eliminar"
                        disabled={isModalAbierto}
                        onClick={() => eliminar(a.id)}
                      >
                        <FaTrash />
                      </button>
                    </DeleteOnly>
                  </td>
                </tr>
              );
            })}
            {inventarioFiltrado.length === 0 && (
              <tr>
                <td colSpan={5} className="resource-empty">
                  No hay artículos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        className="boton-flotante"
        onClick={() => {
          if (isModalAbierto) return;
          setArticuloActual({ id: undefined, nombre: "", cantidad: "", ubicacion: "" });
          setModalVisible(true);
          setTimeout(() => nombreRef.current?.focus(), 0);
        }}
      >
        <FaPlus className="icono-plus" />
      </button>

      {modalVisible && articuloActual && (
        <Modal
          isOpen={modalVisible}
          title={articuloActual.id != null ? "Actualizar artículo" : "Agregar artículo"}
          onClose={cerrarModal}
          initialFocusRef={nombreRef as React.RefObject<HTMLInputElement>}
          size="xl"
          variant="light"
          actions={
            <>
              <button className="btn-primary" onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button className="btn-ghost" onClick={cerrarModal} disabled={saving}>
                Cancelar
              </button>
            </>
          }
        >
          <label htmlFor="nombre">Nombre:</label>
          <input
            id="nombre"
            ref={nombreRef}
            value={articuloActual.nombre}
            onChange={(e) => setArticuloActual({ ...articuloActual, nombre: e.target.value })}
          />

          <label htmlFor="ubicacion">Ubicación:</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              id="ubicacion"
              value={articuloActual.ubicacion}
              onChange={(e) => setArticuloActual({ ...articuloActual, ubicacion: e.target.value })}
              disabled={saving}
            >
              <option value="">Sin asignar</option>
              {loadingUbicaciones ? (
                <option value="" disabled>Cargando…</option>
              ) : (
                ubicacionesUniq.map((u) => (
                  <option key={`loc-modal-${u}`} value={u}>{u}</option>
                ))
              )}
            </select>

            <button type="button" className="btn" onClick={agregarNuevaUbicacion} disabled={busyLoc || saving}>
              <FaPlus /> Nueva
            </button>

            <DeleteOnly resource="inventario">
              {articuloActual.ubicacion && (
                <button type="button" className="btn-danger" onClick={() => eliminarUbicacion(articuloActual.ubicacion as string)} disabled={saving}>
                  <FaTrash />
                </button>
              )}
            </DeleteOnly>
          </div>

          <label htmlFor="cantidad">Cantidad:</label>
          <input
            id="cantidad"
            type="number"
            value={articuloActual.cantidad}
            onChange={(e) =>
              setArticuloActual({ ...articuloActual, cantidad: e.target.value.replace(",", ".") })
            }
            disabled={saving}
          />
        </Modal>
      )}
    </div>
  );
}
