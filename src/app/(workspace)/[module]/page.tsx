import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorize";
import { permissions, type Permission } from "@/lib/auth/permissions";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
const phases: Record<string, number> = { customers: 2, suppliers: 2, services: 2, itineraries: 3, quotations: 4, bookings: 5, invoices: 6, payments: 6, reports: 7, settings: 8, users: 8 };
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) { const { module } = await params; if (!permissions.includes(module as Permission) || !phases[module]) notFound(); await requirePermission(module as Permission); return <div className="flex flex-col gap-6"><div><span className="eyebrow">Workspace module</span><h1 className="page-title capitalize">{module === "users" ? "Team management" : module}</h1></div><Empty className="border bg-card py-16"><EmptyHeader><EmptyMedia variant="icon"><Icon name="signpost-split" /></EmptyMedia><EmptyTitle>This module is coming next</EmptyTitle><EmptyDescription>Authentication and access controls are ready. This module is scheduled for Phase {phases[module]}.</EmptyDescription></EmptyHeader><Badge variant="secondary">Phase {phases[module]}</Badge></Empty></div>; }
