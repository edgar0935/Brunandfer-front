import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

type ProtectedProps =
  | { asRoute?: true; children?: never }
  | { asRoute?: false; children: React.ReactNode }
  & { action?: "create" | "read" | "update" | "delete"; resource?: string; fallback?: React.ReactNode };

export function Protected(props: ProtectedProps) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) return null; // o un spinner

  const allowed = user && (props.action ? hasPermission(props.action, props.resource) : true);

  // Modo ruta protegida
  if (props.asRoute) {
    if (!user) return <Navigate to="/login" replace />;
    if (props.action && !allowed) return <Navigate to="/dashboard" replace />;
    return <Outlet />;
  }

  // Modo envoltorio de UI
  if (!props.children) return null;
  if (!user) return props.fallback ?? null;
  if (props.action && !allowed) return props.fallback ?? null;

  return <>{props.children}</>;
}
