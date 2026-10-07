export type Role = "admin" | "accountant" | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  accountant: "Accountant",
  viewer: "Viewer",
};

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 3,
  accountant: 2,
  viewer: 1,
};

export function hasRole(userRole: Role | undefined, required: Role): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
