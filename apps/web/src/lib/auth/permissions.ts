import { Role } from "./roles";

export const PERMISSIONS = {
  "documents:read": ["viewer", "accountant", "admin"],
  "documents:update": ["accountant", "admin"],
  "exceptions:read": ["viewer", "accountant", "admin"],
  "exceptions:resolve": ["accountant", "admin"],
  "rag:ask": ["viewer", "accountant", "admin"],
  "audit:read": ["admin"],
  "users:read": ["admin"],
  "users:update": ["admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(userRole: Role | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(userRole);
}
