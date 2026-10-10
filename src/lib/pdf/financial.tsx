import "server-only";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { loadDocument } from "@/components/finance/server";
import {
  money,
  statusLabel,
  outstanding,
  refundDue,
  type FinanceKind,
} from "@/components/finance/types";
import { z } from "zod";
import { loadPdfLogo } from "@/lib/settings/pdf-logo";
import { requirePermission } from "@/lib/auth/authorize";
const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#203744",
  },
  header: {
    borderBottomWidth: 3,
    borderBottomColor: "#087f78",
    paddingBottom: 18,
    marginBottom: 22,
  },
  logo: { width: 80, height: 50, objectFit: "contain", marginBottom: 10 },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#087f78" },
  muted: { fontSize: 9, color: "#586c77", marginTop: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  meta: { flexDirection: "row", marginBottom: 20, gap: 24 },
  half: { flex: 1 },
  label: { fontSize: 9, color: "#586c77", marginBottom: 4 },
  strong: { fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#edf5f4",
    padding: 8,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dde7eb",
  },
  description: { width: "40%", paddingRight: 8 },
  qty: { width: "8%" },
  unit: { width: "15%", textAlign: "right" },
  discount: { width: "12%", textAlign: "right" },
  tax: { width: "10%", textAlign: "right" },
  total: { width: "15%", textAlign: "right" },
  summary: { alignSelf: "flex-end", width: 220, marginTop: 18 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  grand: {
    borderTopWidth: 1,
    borderTopColor: "#087f78",
    paddingTop: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  terms: { marginTop: 26, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#586c77",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
export async function financialPdf(
  kind: Extract<FinanceKind, "quotations" | "invoices">,
  id: string,
) {
  await requirePermission(kind);
  if (!z.uuid().safeParse(id).success)
    return new Response("Document not found", { status: 404 });
  try {
    const data = await loadDocument(kind, id);
    if (!data) return new Response("Document not found", { status: 404 });
    const db = await createClient();
    const settings = await db
      .from("settings")
      .select("company_name,email,phone,address,tax_id,bank_details,logo_path")
      .eq("id", 1)
      .maybeSingle();
    if (settings.error) throw new Error("Unable to load company details");
    const company = settings.data ?? {
      company_name: "Emerald Isle Travels",
      email: "",
      phone: "",
      address: "",
      tax_id: "",
      bank_details: "",
    };
    const logo = await loadPdfLogo(settings.data?.logo_path);
    const { record, items, customer } = data;
    const title =
      record.document_type === "credit_note"
        ? "Credit note"
        : kind === "quotations"
          ? "Quotation"
          : "Invoice";
    const document = (
      <Document
        title={`${title} ${record.number}`}
        author={company.company_name}
      >
        <Page size="A4" style={styles.page}>
          <View style={styles.header} fixed>
            {logo && (
              // React PDF embeds a PDF image and does not support HTML alt attributes.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={styles.logo} />
            )}
            <Text style={styles.brand}>{company.company_name}</Text>
            {company.address && (
              <Text style={styles.muted}>{company.address}</Text>
            )}
            <Text style={styles.muted}>
              {[
                company.email,
                company.phone,
                company.tax_id ? "Tax ID: " + company.tax_id : "",
              ]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          </View>
          <Text style={styles.title}>
            {title} {record.number}
          </Text>
          <View style={styles.meta}>
            <View style={styles.half}>
              <Text style={styles.label}>Prepared for</Text>
              <Text style={styles.strong}>
                {record.billing_name ?? customer?.name ?? "Customer"}
              </Text>
              {(record.billing_email ?? customer?.email) && (
                <Text style={styles.muted}>
                  {record.billing_email ?? customer?.email}
                </Text>
              )}
              {record.billing_address && (
                <Text style={styles.muted}>{record.billing_address}</Text>
              )}
            </View>
            <View style={styles.half}>
              <Text>Status: {statusLabel(record.status)}</Text>
              {kind === "quotations" ? (
                <>
                  <Text style={styles.muted}>
                    Travel: {record.start_date ?? "To be confirmed"}
                    {record.end_date ? " to " + record.end_date : ""}
                  </Text>
                  <Text style={styles.muted}>
                    Destination: {record.destination || "To be confirmed"}
                  </Text>
                  <Text style={styles.muted}>
                    Travelers: {record.traveler_count ?? 1}
                  </Text>
                  <Text style={styles.muted}>
                    Valid until: {record.valid_until ?? "Not specified"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.muted}>Issued: {record.issue_date}</Text>
                  <Text style={styles.muted}>
                    Due: {record.due_date ?? "On receipt"}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.description}>Service</Text>
            <Text style={styles.qty}>Qty</Text>
            <Text style={styles.unit}>Unit price</Text>
            <Text style={styles.discount}>Discount</Text>
            <Text style={styles.tax}>Tax</Text>
            <Text style={styles.total}>Total</Text>
          </View>
          {items.map((item, index) => (
            <View key={item.id ?? index} style={styles.row} wrap={false}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.qty}>{String(item.quantity)}</Text>
              <Text style={styles.unit}>
                {money(item.unit_price_minor, record.currency)}
              </Text>
              <Text style={styles.discount}>
                {money(item.discount_minor, record.currency)}
              </Text>
              <Text style={styles.tax}>{String(item.tax_rate)}%</Text>
              <Text style={styles.total}>
                {money(item.total_minor, record.currency)}
              </Text>
            </View>
          ))}
          <View style={styles.summary} wrap={false}>
            <View style={styles.summaryRow}>
              <Text>Subtotal</Text>
              <Text>{money(record.subtotal_minor, record.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Discount</Text>
              <Text>{money(record.discount_minor, record.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Tax</Text>
              <Text>{money(record.tax_minor, record.currency)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.grand]}>
              <Text>Total</Text>
              <Text>{money(record.total_minor, record.currency)}</Text>
            </View>
            {kind === "invoices" && record.document_type !== "credit_note" && (
              <>
                <View style={styles.summaryRow}>
                  <Text>Paid</Text>
                  <Text>{money(record.paid_minor, record.currency)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>Credits</Text>
                  <Text>{money(record.credited_minor, record.currency)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>Balance</Text>
                  <Text>{money(outstanding(record), record.currency)}</Text>
                </View>
                {refundDue(record) > 0 && (
                  <View style={styles.summaryRow}>
                    <Text>Refund due</Text>
                    <Text>{money(refundDue(record), record.currency)}</Text>
                  </View>
                )}
              </>
            )}
          </View>
          {record.terms && (
            <View style={styles.terms}>
              <Text style={styles.strong}>Terms and conditions</Text>
              <Text>{record.terms}</Text>
            </View>
          )}
          {kind === "invoices" && company.bank_details && (
            <View style={styles.terms}>
              <Text style={styles.strong}>Payment details</Text>
              <Text>{company.bank_details}</Text>
            </View>
          )}
          <View style={styles.footer} fixed>
            <Text>
              {company.company_name} | {record.number}
            </Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      </Document>
    );
    const buffer = await renderToBuffer(document);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${record.number ?? title}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Unable to generate PDF. Please try again.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
