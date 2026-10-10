import { canAccess } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/authorize";
import { loadCompany } from "@/lib/settings/data";
import { WorkspaceNav } from "@/components/workspace-nav";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { developmentWorkspace } from "@/lib/development/config";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const company = await loadCompany();
  return (
    <div className="workspace">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="workspace-sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="compass" />
          </span>
          <div>
            <strong>{company?.company_name || "Emerald Isle Travels"}</strong>
            <span>Consultant workspace</span>
          </div>
        </div>
        <WorkspaceNav role={profile.role} />
        <div className="sidebar-note">
          <Icon name="geo-alt" />
          <span>From first enquiry to departure.</span>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          {canAccess(profile.role, "customers") ? (
            <form
              action="/customers"
              className="flex min-w-0 max-w-sm flex-1 items-center gap-2"
            >
              <Icon name="search" className="text-muted-foreground" />
              <input
                className="min-w-0 w-full bg-transparent text-sm outline-none"
                name="q"
                aria-label="Find a customer"
                placeholder="Find a customer…"
              />
            </form>
          ) : (
            <span className="text-sm text-muted-foreground">
              Financial workspace
            </span>
          )}
          <div className="flex shrink-0 items-center gap-3">
            {developmentWorkspace() && (
              <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                Local workspace
              </span>
            )}
            <span className="hidden text-sm sm:inline">
              {profile.full_name}
            </span>
            {company?.logo_path && (
              <Image
                unoptimized
                src={`/settings/logo?v=${encodeURIComponent(company.logo_path)}`}
                alt={`${company.company_name} logo`}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
            )}
          </div>
        </header>
        <main id="main-content" className="workspace-content">
          {children}
        </main>
      </div>
    </div>
  );
}
