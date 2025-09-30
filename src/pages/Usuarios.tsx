import React, { useMemo, useRef, useState, useEffect } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Modal from "@/components/Modal";
import { Protected } from "@/auth/Protected";
import { useAuth } from "@/auth/AuthProvider";
import { getUsers, createUser, deleteUser, type User } from "@/services/users";
import "@/styles/usuarios.css";

const MySwal = withReactContent(Swal);

type Draft = {
  nombre: string;
  apellido: string;
  username: string;
  password: string;
  role: "admin" | "user";
};

export default function Usuarios() {
  const { user: me } = useAuth(); // para saber si quien crea es admin
  const [rows, setRows] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    nombre: "",
    apellido: "",
    username: "",
    password: "",
    role: "user",
  });
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setRows(getUsers()); }, []);

  const total = rows.length;
  const rowsSorted = useMemo(
    () => [...rows].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [rows]
  );

  function openCreate() {
    setDraft({ nombre: "", apellido: "", username: "", password: "", role: "user" });
    setOpen(true);
    setTimeout(() => firstRef.current?.focus(), 0);
  }

  async function onSave() {
    const nombre = draft.nombre.trim();
    const apellido = draft.apellido.trim();
    const username = draft.username.trim();
    const password = draft.password;

    if (!nombre || !apellido || !username || !password) {
      await MySwal.fire({
        icon: "error",
        title: "Campos obligatorios",
        text: "Nombre, Apellido, Usuario y Contraseña son requeridos.",
        confirmButtonColor: "#c70000",
      });
      return;
    }

    // username único
    const exists = getUsers().some(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (exists) {
      await MySwal.fire({
        icon: "error",
        title: "Usuario en uso",
        text: "El nombre de usuario ya está registrado.",
        confirmButtonColor: "#c70000",
      });
      return;
    }

    // Solo un admin puede asignar admin; si no lo es, fuerza 'user'
    const role: "admin" | "user" = me?.role === "admin" ? draft.role : "user";

    createUser({ nombre, apellido, username, password, role });
    setRows(getUsers());
    setOpen(false);

    await MySwal.fire({
      icon: "success",
      title: "Usuario creado",
      text: `${nombre} ${apellido} fue agregado como ${role === "admin" ? "Administrador" : "Operador"}.`,
      confirmButtonColor: "#c70000",
    });
  }

  async function onDelete(id: string) {
    const target = rows.find((u) => u.id === id);
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

    deleteUser(id);
    setRows(getUsers());

    await MySwal.fire({
      icon: "success",
      title: "Eliminado",
      text: "El usuario fue eliminado.",
      confirmButtonColor: "#c70000",
    });
  }

  return (
    <div className="usuarios-page">
      <div className="usuarios-header">
        <h1 className="usuarios-title">Gestión de Usuarios</h1>
        <span className="usuarios-meta">{total} usuario(s)</span>
      </div>

      <Protected action="create" resource="usuarios">
        <button className="btn-primary crear-btn" onClick={openCreate}>
          ➕ Crear usuario
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
                <td>{u.username}</td>
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
                <td colSpan={4} className="usuarios-empty">No hay usuarios registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal “Nuevo usuario” */}
      {open && (
        <Modal
          isOpen={open}
          title="Nuevo usuario"
          onClose={() => setOpen(false)}
          initialFocusRef={firstRef as React.RefObject<HTMLInputElement>}
          actions={
            <div className="btn-row spaced">
              <button className="btn-primary" onClick={onSave}>Guardar</button>
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
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
                <label htmlFor="username">Usuario</label>
                <input
                  id="username"
                  type="text"
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

              {/* Selector de rol SOLO visible si el que crea es admin */}
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
