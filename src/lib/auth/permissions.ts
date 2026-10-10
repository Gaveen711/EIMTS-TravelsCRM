export const roles = ["admin", "agent", "accountant"] as const;
export type Role = (typeof roles)[number];
export const permissions = [
  "dashboard",
  "customers",
  "suppliers",
  "services",
  "itineraries",
  "quotations",
  "bookings",
  "invoices",
  "payments",
  "reports",
  "settings",
  "users",
] as const;
export type Permission = (typeof permissions)[number];
const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: permissions,
  agent: [
    "dashboard",
    "customers",
    "suppliers",
    "services",
    "itineraries",
    "quotations",
    "bookings",
  ],
  accountant: ["dashboard", "bookings", "invoices", "payments", "reports"],
};
export function isRole(value: unknown): value is Role {
  return roles.includes(value as Role);
}
export function canAccess(role: Role, permission: Permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}
export function canManage(role: Role, permission: Permission) {
  return (
    canAccess(role, permission) &&
    !(role === "accountant" && permission === "bookings")
  );
}
