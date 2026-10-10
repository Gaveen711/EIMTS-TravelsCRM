"use client";
import { canManage, canAccess, type Role } from "@/lib/auth/permissions";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  convertQuotation,
  setQuotationStatus,
  updateBooking,
  invoiceFromBooking,
  setInvoiceStatus,
  recordPayment,
  creditInvoice,
} from "@/lib/finance/actions";
import { parseMoney } from "@/lib/catalog/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TravelerForm } from "./traveler-form";
import { PaymentForm } from "./payment-form";
import {
  statusLabel,
  type FinanceKind,
  type FinanceRecord,
  type FinanceLine,
  type Traveler,
} from "./types";
const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
type Result = { id?: string; error?: string };
export function DocumentActions({
  kind,
  role,
  record,
  items,
  travelers,
}: {
  kind: FinanceKind;
  role: Role;
  record: FinanceRecord;
  items: FinanceLine[];
  travelers: Traveler[];
}) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState(false);
  async function run(action: () => Promise<Result>, navigate?: FinanceKind) {
    setBusy(true);
    setFeedback("");
    setFeedbackError(false);
    try {
      const result = await action();
      if (result.error) {
        setFeedback(result.error);
        setFeedbackError(true);
        return false;
      } else if (result.id && navigate) {
        if (canAccess(role, navigate)) router.push(`/${navigate}/${result.id}`);
        else
          setFeedback(
            "Invoice created. Your accounting team can open it in Invoices.",
          );
      } else router.refresh();
      return true;
    } catch {
      setFeedback("Unable to complete this action. Please try again.");
      setFeedbackError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <fieldset disabled={!hydrated || busy} className="contents">
        {kind === "quotations" && (
          <section className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
            {(record.status === "draft"
              ? ["sent"]
              : record.status === "sent"
                ? ["accepted", "rejected", "expired"]
                : []
            ).map((status) => (
              <Button
                key={status}
                disabled={busy}
                variant="outline"
                onClick={() => run(() => setQuotationStatus(record.id, status))}
              >
                {status === "sent"
                  ? "Mark as sent"
                  : "Mark " + statusLabel(status).toLowerCase()}
              </Button>
            ))}
            {record.status === "accepted" && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(() => convertQuotation(record.id), "bookings")
                }
              >
                Convert to booking
              </Button>
            )}
          </section>
        )}
        {kind === "bookings" && (
          <>
            {canManage(role, "bookings") && (
              <>
                <form
                  className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
                  action={(data) => {
                    void run(() =>
                      updateBooking(record.id, {
                        status: String(data.get("status")),
                        notes: record.notes ?? "",
                        travelers: travelers.map((t) => ({
                          ...t,
                          date_of_birth: t.date_of_birth ?? "",
                          nationality: t.nationality ?? "",
                          passport_number: t.passport_number ?? "",
                          passport_expiry: t.passport_expiry ?? "",
                          notes: t.notes ?? "",
                        })),
                        confirmations: items.map((item) => ({
                          id: item.id,
                          confirmation_status: String(
                            data.get(`status-${item.id}`) ??
                              item.confirmation_status ??
                              "pending",
                          ),
                          confirmation_number: String(
                            data.get(`number-${item.id}`) ??
                              item.confirmation_number ??
                              "",
                          ),
                        })),
                      }),
                    );
                  }}
                >
                  <label className="text-sm">
                    Booking status
                    <select
                      name="status"
                      defaultValue={record.status}
                      className={`${selectClass} block`}
                    >
                      {["pending", "confirmed", "completed", "cancelled"].map(
                        (status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th className="py-2">Service</th>
                          <th>Confirmation</th>
                          <th>Supplier reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="min-w-40 py-2 pr-3">
                              {item.description}
                            </td>
                            <td className="pr-3">
                              <select
                                aria-label={`Confirmation for ${item.description}`}
                                name={`status-${item.id}`}
                                defaultValue={
                                  item.confirmation_status ?? "pending"
                                }
                                className={selectClass}
                              >
                                {[
                                  "pending",
                                  "requested",
                                  "confirmed",
                                  "cancelled",
                                ].map((status) => (
                                  <option key={status} value={status}>
                                    {statusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <Input
                                aria-label={`Reference for ${item.description}`}
                                name={`number-${item.id}`}
                                defaultValue={item.confirmation_number ?? ""}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button disabled={busy}>Save confirmations</Button>
                </form>
                <TravelerForm
                  travelers={travelers}
                  onSave={(next) =>
                    run(() =>
                      updateBooking(record.id, {
                        status: record.status,
                        notes: record.notes ?? "",
                        travelers: next,
                        confirmations: items.map((item) => ({
                          id: item.id,
                          confirmation_status:
                            item.confirmation_status ?? "pending",
                          confirmation_number: item.confirmation_number ?? "",
                        })),
                      }),
                    )
                  }
                  disabled={busy}
                />
              </>
            )}
            {record.status !== "cancelled" && (
              <form
                className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
                action={(data) => {
                  let amount;
                  try {
                    const value = String(data.get("amount") ?? "");
                    amount = value
                      ? parseMoney(value, record.currency)
                      : undefined;
                  } catch {
                    setFeedback("Enter a valid invoice amount.");
                    return;
                  }
                  void run(
                    () =>
                      invoiceFromBooking(record.id, {
                        billing_type: String(data.get("billing_type")) as
                          "deposit" | "partial" | "balance",
                        amount_minor: amount,
                        issue_date: String(data.get("issue_date")),
                        due_date: String(data.get("due_date")),
                        terms: record.terms ?? "",
                      }),
                    "invoices",
                  );
                }}
              >
                <h2 className="w-full font-semibold">Generate an invoice</h2>
                <label className="text-sm">
                  Invoice type
                  <select
                    name="billing_type"
                    className={`${selectClass} block`}
                    defaultValue="balance"
                  >
                    <option value="balance">Balance</option>
                    <option value="deposit">Deposit</option>
                    <option value="partial">Partial</option>
                  </select>
                </label>
                <label className="text-sm">
                  Amount ({record.currency}, optional for balance)
                  <Input name="amount" inputMode="decimal" />
                </label>
                <label className="text-sm">
                  Issue date
                  <Input
                    name="issue_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label className="text-sm">
                  Due date
                  <Input name="due_date" type="date" />
                </label>
                <Button disabled={busy}>Generate invoice</Button>
              </form>
            )}
          </>
        )}
        {kind === "invoices" && (
          <>
            <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
              {record.status === "draft" && (
                <Button
                  disabled={busy}
                  onClick={() => run(() => setInvoiceStatus(record.id, "sent"))}
                >
                  Issue invoice
                </Button>
              )}
              {!["draft", "void"].includes(record.status) && (
                <p className="text-sm text-muted-foreground">
                  Issued invoices are locked. Adjustments use a credit note or
                  void.
                </p>
              )}
              {record.status !== "void" && (record.paid_minor ?? 0) === 0 && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Void this invoice? It will remain in the audit history.",
                      )
                    )
                      void run(() => setInvoiceStatus(record.id, "void"));
                  }}
                >
                  Void invoice
                </Button>
              )}
            </section>
            {!["draft", "void", "paid"].includes(record.status) &&
              record.document_type !== "credit_note" &&
              (record.total_minor ?? 0) >
                (record.paid_minor ?? 0) + (record.credited_minor ?? 0) && (
                <PaymentForm
                  key={
                    String(record.paid_minor) +
                    "-" +
                    String(record.credited_minor)
                  }
                  record={record}
                  onSave={(input) => run(() => recordPayment(input))}
                  disabled={busy}
                />
              )}{" "}
            {!["draft", "void"].includes(record.status) &&
              record.document_type !== "credit_note" && (
                <form
                  className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
                  action={(data) => {
                    let amount;
                    try {
                      amount = parseMoney(
                        String(data.get("amount")),
                        record.currency,
                      );
                    } catch {
                      setFeedback("Enter a valid credit amount.");
                      return;
                    }
                    void run(
                      () =>
                        creditInvoice(record.id, {
                          amount_minor: amount,
                          reason: String(data.get("reason")),
                          issue_date: new Date().toISOString().slice(0, 10),
                        }),
                      "invoices",
                    );
                  }}
                >
                  <h2 className="w-full font-semibold">
                    Credit note for cancellation or adjustment
                  </h2>
                  <label className="text-sm">
                    Credit amount ({record.currency})
                    <Input name="amount" required inputMode="decimal" />
                  </label>
                  <label className="flex-1 text-sm">
                    Reason
                    <Input name="reason" required maxLength={2000} />
                  </label>
                  <Button variant="outline" disabled={busy}>
                    Create credit note
                  </Button>
                </form>
              )}
          </>
        )}
        {feedback && (
          <p
            role={feedbackError ? "alert" : "status"}
            className={
              feedbackError
                ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                : "rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary"
            }
          >
            {feedback}
          </p>
        )}
      </fieldset>
    </div>
  );
}
