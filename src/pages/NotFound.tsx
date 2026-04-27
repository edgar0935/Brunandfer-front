// src/pages/NotFound.tsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Página no encontrada</h1>
        <p style={{ color: "var(--ink-2)" }}>
          La ruta que intentaste abrir no existe.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link className="btn" to="/dashboard">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
