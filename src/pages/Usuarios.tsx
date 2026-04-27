// src/pages/Usuarios.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Modal from "@/components/Modal";
import { Protected } from "@/auth/Protected";
import { useAuth } from "@/auth/AuthProvider";
import "@/styles/usuarios.css";

/** SweetAlert consistente con el resto */
const MySwal = withReactContent(
  Swal.mixin({
    heightAuto: false,
    backdrop: true,
  })
);

type Draft = {
  nombre: string;
  apellido: string;
  username: string; // email
  password: string;
  role: "admin" | "user";
};

type UserRow = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  role: "admin" | "user";
  is_active?: 0 | 1;
};

export default function Usuarios() {
  const { user: me } = useAuth();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    nombre: "",
    apellido: "",
    username: "",
    password: "",
    role: "user",
  });
  const firstRef = useRef<HTMLInputElement | null>(null);

  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      const raw = await res.json().catch(() => null);

      const list: unknown =
        Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];

      if (!Array.isArray(list)) throw new Error("Formato inesperado");
      setRows(list as UserRow[]);
    } catch (err) {
      console.error(err);
      setRows([]);
      await MySwal.fire({
        icon: "error",
        title: "No se pudo cargar la lista",
        text: "Intenta recargar la página.",
        confirmButtonColor: "#c70000",
      });
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  /** -------------------------
   *   FILTRAR ADMIN LOGEADO
   * ------------------------- */
  const safeRows = Array.isArray(rows) ? rows : [];

  const visibleRows = useMemo(() => {
    if (me?.role === "admin" && typeof me.id === "number") {
      return safeRows.filter((u) => u.id !== me.id);
    }
    return safeRows;
  }, [safeRows, me]);

  const total = visibleRows.length;

  const rowsSorted = useMemo(
    () =>
      [...visibleRows].sort((a, b) =>
        `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
      ),
    [visibleRows]
  );

  function openCreate() {
    setDraft({
      nombre: "",
      apellido: "",
      username: "",
      password: "",
      role: "user",
    });
    setOpen(true);
    setTimeout(() => firstRef.current?.focus(), 0);
  }

  async function onSave() {
    const nombre = draft.nombre.trim();
    const apellido = draft.apellido.trim();
    const email = draft.username.trim();
    const password = draft.password;

    if (!nombre || !apellido || !email || !password) {
      await MySwal.fire({
        icon: "error",
        title: "Campos obligatorios",
        text: "Nombre, Apellido, Usuario (email) y Contraseña son requeridos.",
        confirmButtonColor: "#c70000",
      });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      await MySwal.fire({
        icon: "error",
        title: "Usuario inválido",
        text: "Escribe un correo electrónico válido.",
        confirmButtonColor: "#c70000",
      });
      return;
    }

    const dup = safeRows.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (dup) {
      await MySwal.fire({
        icon: "error",
        title: "Usuario en uso",
        text: "Ese correo ya está registrado.",
        confirmButtonColor: "#c70000",
      });
      return;
    }

    const role: "admin" | "user" = me?.role === "admin" ? draft.role : "user";

    try {
      setSaving(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, apellido, email, password, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      await loadUsers();
      setOpen(false);

      await MySwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Usuario creado",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: any) {
      console.error(err);
      await MySwal.fire({
        icon: "error",
        title: "No se pudo crear",
        text: err?.message || "Error inesperado",
        confirmButtonColor: "#c70000",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    const target = safeRows.find((u) => u.id === id);
    const ask = await MySwal.fire({
      title: "¿Eliminar usuario?",
      text: target ? `${target.nombre} ${target.apellido}` : "",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#c70000",
    });
    if (!ask.isConfirmed) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      await loadUsers();

      await MySwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Usuario eliminado",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: any) {
      console.error(err);
      await MySwal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: err?.message || "Error inesperado",
        confirmButtonColor: "#c70000",
      });
    }
  }

  return (
    <div className="usuarios-page">
      <div className="usuarios-header">
        <h1 className="usuarios-title">Gestión de Usuarios</h1>
        <span className="usuarios-meta">{total} usuario(s)</span>
      </div>

      <Protected action="create" resource="usuarios">
        <button className="btn-primary crear-btn" onClick={openCreate}>
          + Crear usuario
        </button>
      </Protected>

      <div className="usuarios-table-wrap">
        <table className="usuarios-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th style={{ width: 140 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((u) => (
              <tr key={u.id}>
                <td>{`${u.nombre} ${u.apellido}`}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`chip chip--${u.role === "admin" ? "danger" : "neutral"}`}>
                    {u.role === "admin" ? "Administrador" : "Operador"}
                  </span>
                </td>
                <td>
                  <Protected action="delete" resource="usuarios" fallback={null}>
                    <button className="btn-danger" onClick={() => onDelete(u.id)}>
                      Eliminar
                    </button>
                  </Protected>
                </td>
              </tr>
            ))}
            {rowsSorted.length === 0 && (
              <tr>
                <td colSpan={4} className="usuarios-empty">
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal
          isOpen={open}
          title="Nuevo usuario"
          onClose={() => setOpen(false)}
          initialFocusRef={firstRef as React.RefObject<HTMLInputElement>}
          actions={
            <div className="btn-row spaced">
              <button className="btn-primary" onClick={onSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </button>
            </div>
          }
        >
          <div className="usuario-form">
            <div className="usuario-grid">
              <div className="field-col">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  ref={firstRef}
                  type="text"
                  value={draft.nombre}
                  onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                />
              </div>

              <div className="field-col">
                <label htmlFor="apellido">Apellido</label>
                <input
                  id="apellido"
                  type="text"
                  value={draft.apellido}
                  onChange={(e) => setDraft((d) => ({ ...d, apellido: e.target.value }))}
                />
              </div>

              <div className="field-col">
                <label htmlFor="username">Usuario (email)</label>
                <input
                  id="username"
                  type="email"
                  value={draft.username}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, username: e.target.value.trimStart() }))
                  }
                  autoComplete="username"
                />
              </div>

              <div className="field-col">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={draft.password}
                  onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>

              {me?.role === "admin" && (
                <div className="field-col role-col">
                  <label>Permisos</label>
                  <div className="role-picker">
                    <label className={`role-option ${draft.role === "user" ? "is-active" : ""}`}>
                      <input
                        type="radio"
                        name="role"
                        value="user"
                        checked={draft.role === "user"}
                        onChange={() => setDraft((d) => ({ ...d, role: "user" }))}
                      />
                      Operador
                    </label>
                    <label className={`role-option ${draft.role === "admin" ? "is-active" : ""}`}>
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={draft.role === "admin"}
                        onChange={() => setDraft((d) => ({ ...d, role: "admin" }))}
                      />
                      Administrador
                    </label>
                  </div>
                </div>
              )}
            </div>

            <p className="usuario-hint">
              Si no seleccionas permisos, el usuario se creará como <b>Operador</b>.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
