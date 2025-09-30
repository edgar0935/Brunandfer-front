import { useAuth } from "./AuthProvider";
import { canDo } from "./permissions";
import type { Action, Resource } from "./types";

export function useCan(action: Action, resource: Resource) {
  const { user } = useAuth();
  if (!user) return false;
  return canDo(user.role, action, resource);
}
