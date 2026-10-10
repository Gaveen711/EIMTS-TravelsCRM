"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess, permissions, type Role } from "@/lib/auth/permissions";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
const icons: Record<string, string> = {
  dashboard: "grid-1x2",
  customers: "people",
  suppliers: "buildings",
  services: "collection",
  itineraries: "map",
  quotations: "file-earmark-text",
  bookings: "briefcase",
  invoices: "receipt",
  payments: "credit-card",
  reports: "bar-chart",
  settings: "gear",
  users: "person-badge",
};
export function WorkspaceNav({ role }: { role: Role }) {
  const path = usePathname();
  return (
    <nav className="workspace-nav" aria-label="Main navigation">
      {permissions
        .filter((key) => key !== "users" && canAccess(role, key))
        .map((key) => (
          <Link
            key={key}
            href={`/${key}`}
            className={cn(
              "nav-link",
              (path === `/${key}` || path.startsWith(`/${key}/`)) && "active",
            )}
            aria-current={
              path === `/${key}` || path.startsWith(`/${key}/`)
                ? "page"
                : undefined
            }
          >
            <Icon name={icons[key]} />
            <span className="capitalize">
              {key === "dashboard"
                ? "Overview"
                : key === "users"
                  ? "Team"
                  : key}
            </span>
          </Link>
        ))}
    </nav>
  );
}
