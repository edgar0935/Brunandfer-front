// src/auth/Protected.tsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

type ProtectedProps = {
  asRoute?: boolean;
  children?: React.ReactNode;
  action?: "create" | "read" | "update" | "delete";
  resource?: string;
  fallback?: React.ReactNode;
};

function Protected(props: ProtectedProps) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) return null; // Puedes poner un spinner si quieres

  const allowed = user && (props.action ? hasPermission(props.action, props.resource) : true);

  // 🔒 Si es una ruta protegida (para usar en el router)
  if (props.asRoute) {
    if (!user) return <Navigate to="/login" replace />;
    if (props.action && !allowed) return <Navigate to="/dashboard" replace />;
    return <Outlet />;
  }

  // 🔒 Si es un envoltorio para proteger contenido dentro de la UI
  if (!props.children) return null;
  if (!user) return props.fallback ?? null;
  if (props.action && !allowed) return props.fallback ?? null;

  return <>{props.children}</>;
}

// ✅ Exporta ambas variantes (default y nombrada)
export default Protected;
export { Protected };
