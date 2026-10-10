import { requirePermission } from "@/lib/auth/authorize";
import { canManage } from "@/lib/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "./document-form";
import { loadChoices, loadDocument } from "./server";
import type { FinanceKind } from "./types";
export async function DocumentEditor({
  kind,
  id,
}: {
  kind: FinanceKind;
  id?: string;
}) {
  const profile = await requirePermission(kind);
  if (!canManage(profile.role, kind)) redirect(`/${kind}`);
  const document = id ? await loadDocument(kind, id) : null;
  if (id && !document) notFound();
  if (
    document &&
    ((kind === "invoices" && document.record.status !== "draft") ||
      (kind === "quotations" && document.record.status !== "draft") ||
      (kind === "bookings" &&
        ["completed", "cancelled"].includes(document.record.status)))
  )
    redirect(`/${kind}/${id}`);
  const choices = await loadChoices(kind);
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="page-title">
          {id ? "Edit" : "New"}{" "}
          {kind === "quotations"
            ? "quotation"
            : kind === "bookings"
              ? "booking"
              : "invoice"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Keep customer details, travel dates and service prices in one
          document.
        </p>
      </header>
      <DocumentForm
        kind={kind}
        {...choices}
        record={document?.record}
        items={document?.items}
      />
    </section>
  );
}
