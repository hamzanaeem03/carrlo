export type Role = "OWNER" | "MANAGER" | "STAFF" | "FINANCE";

export type Permission =
  | "dashboard:read"
  | "vehicles:manage"
  | "customers:manage"
  | "bookings:manage"
  | "pickup_return:manage"
  | "payments:manage"
  | "maintenance:manage"
  | "reports:read"
  | "settings:manage";

const rolePermissions: Record<Role, Permission[]> = {
  OWNER: [
    "dashboard:read",
    "vehicles:manage",
    "customers:manage",
    "bookings:manage",
    "pickup_return:manage",
    "payments:manage",
    "maintenance:manage",
    "reports:read",
    "settings:manage",
  ],
  MANAGER: [
    "dashboard:read",
    "vehicles:manage",
    "customers:manage",
    "bookings:manage",
    "pickup_return:manage",
    "maintenance:manage",
    "reports:read",
  ],
  STAFF: [
    "dashboard:read",
    "vehicles:manage",
    "customers:manage",
    "bookings:manage",
    "pickup_return:manage",
  ],
  FINANCE: ["dashboard:read", "payments:manage", "reports:read"],
};

export function hasPermission(role: Role, permission: Permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function assertPermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
