import type { Action, Resource, Role } from "./types";

type Policy = Record<Role, (p: { action: Action; resource: Resource }) => boolean>;

export const can: Policy = {
  admin: () => true, // admin puede todo
  user: ({ action, resource }) => {
    if (resource === "usuarios") return false; // bloquea todo el módulo de usuarios
    if (action === "delete") return false;      // user no puede eliminar en ningún recurso
    return true;
  },
};

export function canDo(role: Role, action: Action, resource: Resource) {
  if (action === "manage") return can[role]({ action: "manage", resource });
  return can[role]({ action, resource });
}
