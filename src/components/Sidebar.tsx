// src/components/Sidebar.tsx
import React, { useEffect, useState, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Package, Truck, History, LogOut, User as UserIcon, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import Protected from "@/auth/Protected";
import "./Sidebar.css";

const Sidebar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const { user, logout } = useAuth();

  /** ---------------------------
   *  HOOKS — SIEMPRE VAN ARRIBA
   * --------------------------- */

  // Cerrar menú al navegar
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Control de clase en <body>
  useEffect(() => {
    if (!user) {
      document.body.classList.remove("menu-open");
      return;
    }

    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open, user]);

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

  /** ---------------------------
   *  RETURN CONDICIONAL — AHORA SÍ
   * --------------------------- */

  if (!user) return null;

  /** ---------------------------
   *  RENDER
   * --------------------------- */

  return (
    <>
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

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside id="app-sidebar" className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-badge" aria-label="B&F">
              <span className="brand-initials">B&F</span>
            </div>
            <div className="brand-caption">BRUN & FER</div>
          </div>
          <h2 className="sidebar-title">MENÚ</h2>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-left">
            <UserIcon className="icon" />
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name">{user?.name ?? user?.email}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>

          <button type="button" className="sidebar-logout" onClick={logout} title="Cerrar sesión">
            <LogOut className="icon" />
            <span>Salir</span>
          </button>
        </div>

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

          <Protected action="read" resource="usuarios">
            <li>
              <NavLink to="/usuarios" className={linkClass}>
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
