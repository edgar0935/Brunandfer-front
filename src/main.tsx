import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthProvider";
import LoadingGate from "@/components/LoadingGate";
import App from "@/App";

// Páginas
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Inventario from "@/pages/Inventario";
import Vehiculos from "@/pages/Vehiculos";
import History from "@/pages/History";
import Usuarios from "@/pages/Usuarios"; // 👈 NUEVO

// Protegido
import { Protected } from "@/auth/Protected";

// Estilos globales
import "@/index.css";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/resource.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* LoadingGate mantiene el splash hasta que termine loading inicial */}
        <LoadingGate minDelay={3530}>
          <Routes>
            <Route element={<App />}>
              {/* pública */}
              <Route path="/login" element={<Login />} />

              {/* privadas */}
              <Route element={<Protected asRoute />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="inventario" element={<Inventario />} />
                <Route path="vehiculos" element={<Vehiculos />} />
                <Route path="historial" element={<History />} />

                {/* Gestión de usuarios (solo admin) */}
                <Route element={<Protected asRoute action="read" resource="usuarios" />}>
                  <Route path="usuarios" element={<Usuarios />} />
                </Route>
              </Route>

              {/* 404 */}
              <Route
                path="*"
                element={<div className="p-6 text-white">No encontrado</div>}
              />
            </Route>
          </Routes>
        </LoadingGate>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
