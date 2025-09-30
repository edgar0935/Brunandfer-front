import React, { useEffect, useState, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Package, Truck, History, LogOut, User as UserIcon, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Protected } from "@/auth/Protected";
import "./sidebar.css";

const Sidebar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const { user, logout } = useAuth();

  // Cerrar al navegar
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Bloquear scroll del body cuando el drawer está abierto (móvil)
  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  // Cerrar con ESC
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `navlink ${isActive ? "active-link" : ""}`;

  const handleToggle = () => {
    setOpen((v) => !v);
    toggleBtnRef.current?.blur();
  };

  return (
    <>
      {/* Botón hamburguesa (visible en móvil por CSS) */}
      <button
        ref={toggleBtnRef}
        type="button"
        className={`sidebar-toggle ${open ? "is-open" : ""}`}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="app-sidebar"
        aria-pressed={open}
        onClick={handleToggle}
        onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
      >
        <span className="burger-line" />
        <span className="burger-line" />
        <span className="burger-line" />
      </button>

      {/* Overlay para cerrar con click fuera */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside id="app-sidebar" className={`sidebar ${open ? "open" : ""}`} aria-hidden={!open}>
        {/* Header con logo B&F */}
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-badge" aria-label="B&F">
              <span className="brand-initials">B&F</span>
            </div>
            <div className="brand-caption">BRUN & FER</div>
          </div>

          <h2 className="sidebar-title">MENÚ</h2>
        </div>

        {/* Usuario + Logout */}
        <div className="sidebar-user">
          <div className="sidebar-user-left">
            <UserIcon className="icon" />
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name">{user?.name ?? "Invitado"}</div>
              <div className="sidebar-user-role">{user?.role ?? "sin sesión"}</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={logout}
            title="Cerrar sesión"
          >
            <LogOut className="icon" />
            <span>Salir</span>
          </button>
        </div>

        {/* Navegación */}
        <ul role="navigation" aria-label="Secciones">
          <li>
            <NavLink to="/dashboard" end className={linkClass}>
              <Home className="icon" />
              Inicio
            </NavLink>
          </li>
          <li>
            <NavLink to="/inventario" className={linkClass}>
              <Package className="icon" />
              Inventario General
            </NavLink>
          </li>
          <li>
            <NavLink to="/vehiculos" className={linkClass}>
              <Truck className="icon" />
              Vehículos
            </NavLink>
          </li>
          <li>
            <NavLink to="/historial" className={linkClass}>
              <History className="icon" />
              Historial de Movimientos
            </NavLink>
          </li>

          {/* 👇 NUEVO: Solo visible para admin */}
          <Protected action="read" resource="usuarios">
            <li>
              <NavLink to="/Usuarios" className={linkClass}>
                <Users className="icon" />
                Gestión de Usuarios
              </NavLink>
            </li>
          </Protected>
        </ul>
      </aside>
    </>
  );
};

export default Sidebar;
