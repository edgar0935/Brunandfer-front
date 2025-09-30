export type Role = "admin" | "user";

export type Action = "read" | "create" | "update" | "delete" | "manage";

export type Resource =
  | "dashboard"
  | "inventario"
  | "vehiculos"
  | "historial"
  | "usuarios"; // 👈 nuevo recurso para crear/gestionar usuarios

export interface User {
  id: string;
  name: string;
  role: Role;
}
