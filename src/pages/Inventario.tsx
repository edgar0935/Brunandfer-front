import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FaFilePdf,
  FaFileExcel,
  FaPrint,
  FaEdit,
  FaTrash,
  FaPlus,
  FaSearch,
  FaBoxes,
} from "react-icons/fa";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Modal from "@/components/Modal";
import DeleteOnly from "@/auth/DeleteOnly"; // 👈 componente para ocultar si no es admin
import { useAuth } from "@/auth/AuthProvider"; // 👈 NUEVO

import { exportInventarioPDF, exportInventarioExcel } from "@/utils/export";
import type { Row } from "@/utils/export";

import { logMovement } from "@/services/activity";
import {
  listInventory,
  upsertArticulo,
  deleteArticulo,
  nextArticuloId,
  type Articulo,
} from "@/services/inventory";

const MySwal = withReactContent(
  Swal.mixin({
    zIndex: 4000,
    heightAuto: false,
    backdrop: true,
  })
);

const UBICACIONES_BASE = ["Taller", "Obra A", "Obra B", "Bodega", "Oficina"];
export type Ubicacion = string;

type ArticuloEditable = {
  id: number;
  nombre: string;
  cantidad: string;
  ubicacion: Ubicacion | "";
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const byIdAsc = (a: Articulo, b: Articulo) => a.id - b.id;

export default function Inventario() {
  const [inventario, setInventario] = useState<Articulo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string>("Todas");
  const [modalVisible, setModalVisible] = useState(false);
  const [articuloActual, setArticuloActual] =
    useState<ArticuloEditable | null>(null);
  const nombreRef = useRef<HTMLInputElement | null>(null);

  // 👇 usuario loggeado → actor para el historial
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

  /* ========================
     CARGA INICIAL
  ======================== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await listInventory();
      if (mounted) setInventario(data);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("ubicaciones_inventario");
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
          setUbicaciones(arr);
          return;
        }
      } catch {}
    }
    setUbicaciones(UBICACIONES_BASE);
  }, []);

  useEffect(() => {
    localStorage.setItem("ubicaciones_inventario", JSON.stringify(ubicaciones));
  }, [ubicaciones]);

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
          <td>${a.id}</td>
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
          <thead><tr><th>ID</th><th>Artículo</th><th>Cantidad</th><th>Ubicación</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [inventarioFiltrado]);

  const abrirModal = useCallback(
    (a: Articulo) => {
      if (isModalAbierto) return;
      setArticuloActual({
        id: a.id,
        nombre: a.nombre,
        cantidad: String(a.cantidad),
        ubicacion: ((a as any).ubicacion as Ubicacion) || "",
      });
      setModalVisible(true);
      setTimeout(() => nombreRef.current?.focus(), 0);
    },
    [isModalAbierto]
  );

  const cerrarModal = useCallback(() => {
    setModalVisible(false);
    setArticuloActual(null);
  }, []);

  const agregarNuevaUbicacion = useCallback(async () => {
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

    setUbicaciones((prev) =>
      Array.from(new Set([...prev, nueva])).sort((a, b) => a.localeCompare(b))
    );
    setArticuloActual((prev) => (prev ? { ...prev, ubicacion: nueva } : prev));
  }, []);

  const eliminarUbicacion = useCallback(
    async (nombre: string) => {
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

      setUbicaciones((prev) =>
        prev.filter((u) => u.trim().toLowerCase() !== target.toLowerCase())
      );

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
          afectados.map(async (a) => {
            const payload = { ...(a as any), ubicacion: "" } as Articulo;
            await upsertArticulo(payload);
          })
        );
        setInventario(await listInventory());

        // 📝 log opcional de limpieza de ubicación
        await logMovement({
          type: "update",
          entity: "ubicacion",
          entityId: target,
          entityName: target,
          description: `Eliminó ubicación “${target}” y desasignó ${afectados.length} artículo(s)`,
          timestamp: new Date().toISOString(),
          actor,
          user: actor.name,
        });
      }
    },
    [inventario, actor]
  );

  const guardar = useCallback(async () => {
    if (!articuloActual) return;
    const nombre = articuloActual.nombre.trim();
    if (!nombre) return;

    const cantidadNumRaw = Number(
      (articuloActual.cantidad ?? "").toString().replace(",", ".")
    );
    const cantidadNum = Number.isFinite(cantidadNumRaw) ? cantidadNumRaw : 0;

    const ubicacion = (articuloActual.ubicacion || "").trim();
    const exists = inventario.some((i) => i.id === articuloActual.id);

    await upsertArticulo({
      id: articuloActual.id,
      nombre,
      cantidad: cantidadNum,
      ubicacion,
    } as Articulo);

    // 📝 LOG con actor
    await logMovement({
      type: exists ? "update" : "create",
      entity: "articulo",
      entityId: articuloActual.id,
      entityName: nombre,
      description: `${exists ? "Actualizó" : "Agregó"} artículo “${nombre}” (id ${articuloActual.id})`,
      timestamp: new Date().toISOString(),
      actor,
      user: actor.name,
    });

    setInventario(await listInventory());
    cerrarModal();
  }, [articuloActual, inventario, cerrarModal, actor]);

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

    // 📝 LOG con actor
    await logMovement({
      type: "delete",
      entity: "articulo",
      entityId: id,
      description: `Eliminó artículo (id ${id})`,
      timestamp: new Date().toISOString(),
      actor,
      user: actor.name,
    });
  }, [actor]);

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

      <div className="resource-search search-with-filters">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Buscar por nombre, ID… o ubicación"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="filter-group">
          <label className="filter-label">Ubicación</label>
          <select
            value={ubicacionFiltro}
            onChange={(e) => setUbicacionFiltro(e.target.value)}
          >
            <option value="Todas">Todas</option>
            {ubicaciones.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="resource-table table-wrapper"
        style={{
          height: "60vh",
          overflowY: "auto",
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table className="inv-table" role="table">
          <thead
            style={{
              position: "sticky",
              top: 0,
              background: "var(--brand)",
              color: "#fff",
              zIndex: 1,
            }}
          >
            <tr>
              <th>ID</th>
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
                  <td>{a.id}</td>
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
          const id = nextArticuloId();
          setArticuloActual({ id, nombre: "", cantidad: "0", ubicacion: "" });
          setModalVisible(true);
          setTimeout(() => nombreRef.current?.focus(), 0);
        }}
      >
        <FaPlus className="icono-plus" />
      </button>

      {modalVisible && articuloActual && (
        <Modal
          isOpen={modalVisible}
          title={
            inventario.some((i) => i.id === articuloActual.id)
              ? "Actualizar artículo"
              : "Agregar artículo"
          }
          onClose={cerrarModal}
          initialFocusRef={nombreRef as React.RefObject<HTMLInputElement>}
          actions={
            <>
              <button className="btn-primary" onClick={guardar}>
                Guardar
              </button>
              <button className="btn-ghost" onClick={cerrarModal}>
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
            onChange={(e) =>
              setArticuloActual({ ...articuloActual, nombre: e.target.value })
            }
          />

          <label htmlFor="ubicacion">Ubicación:</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              id="ubicacion"
              value={articuloActual.ubicacion}
              onChange={(e) =>
                setArticuloActual({
                  ...articuloActual,
                  ubicacion: e.target.value,
                })
              }
            >
              <option value="">Sin asignar</option>
              {ubicaciones.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <button type="button" className="btn" onClick={agregarNuevaUbicacion}>
              <FaPlus /> Nueva
            </button>

            <DeleteOnly resource="inventario">
              {articuloActual.ubicacion && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => eliminarUbicacion(articuloActual.ubicacion)}
                >
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
              setArticuloActual({
                ...articuloActual,
                cantidad: e.target.value.replace(",", "."),
              })
            }
          />
        </Modal>
      )}
    </div>
  );
}
