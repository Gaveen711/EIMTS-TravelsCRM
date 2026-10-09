import { requireProfile } from "@/lib/auth/authorize";
import { logoutAction } from "@/lib/auth/actions";
import { WorkspaceNav } from "@/components/workspace-nav";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <div className="workspace"><a href="#main-content" className="skip-link">Skip to content</a><aside className="workspace-sidebar"><div className="brand"><span className="brand-mark"><Icon name="compass" /></span><div><strong>EMERALD ISLE</strong><span>TRAVELS · CRM</span></div></div><WorkspaceNav role={profile.role} /><div className="sidebar-note"><Icon name="shield-check" /><span>Connected. Organized. Ready.</span></div></aside><div className="workspace-main"><header className="workspace-header"><span className="text-sm text-muted-foreground">Your travel business workspace</span><div className="flex items-center gap-3"><span className="hidden text-sm sm:inline">{profile.full_name || profile.email}</span><Badge variant="secondary" className="capitalize">{profile.role}</Badge><form action={logoutAction}><Button variant="ghost" size="sm"><Icon name="box-arrow-right" data-icon="inline-start" />Sign out</Button></form></div></header><main id="main-content" className="workspace-content">{children}</main></div></div>;
}
