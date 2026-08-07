import type { AppRole } from "@/types/database";

export type Permission =
  | "dashboard:view"
  | "patients:view"
  | "patients:create"
  | "doctors:view"
  | "doctors:manage"
  | "episodes:create"
  | "conversations:view"
  | "alerts:view"
  | "team:view"
  | "team:manage"
  | "settings:manage";

const rolePermissions: Record<AppRole, ReadonlySet<Permission>> = {
  platform_admin: new Set(["dashboard:view", "patients:view", "patients:create", "doctors:view", "doctors:manage", "episodes:create", "conversations:view", "alerts:view", "team:view", "team:manage", "settings:manage"]),
  organization_admin: new Set(["dashboard:view", "patients:view", "patients:create", "doctors:view", "doctors:manage", "episodes:create", "conversations:view", "alerts:view", "team:view", "team:manage", "settings:manage"]),
  doctor: new Set(["dashboard:view", "patients:view", "patients:create", "doctors:view", "episodes:create", "conversations:view", "alerts:view", "team:view"]),
  staff: new Set(["dashboard:view", "patients:view", "patients:create", "doctors:view", "episodes:create", "conversations:view", "alerts:view", "team:view"]),
};

export function can(role: AppRole, permission: Permission) {
  return rolePermissions[role].has(permission);
}
