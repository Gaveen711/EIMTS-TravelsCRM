"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldError } from "@/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Icon } from "@/components/icon";
import {
  supplierSchema,
  serviceSchema,
  supplierKinds,
  supportedCurrencies,
  moneyInput,
  type Supplier,
  type Service,
  type SupplierInput,
  type ServiceInput,
} from "@/lib/catalog/schema";
import { saveCatalog, deleteSupplier } from "@/lib/catalog/actions";
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export function CatalogEditor({
  kind,
  suppliers,
  record,
  onClose,
}: {
  kind: "suppliers" | "services";
  suppliers: { id: string; name: string }[];
  record?: Supplier | Service;
  onClose: () => void;
}) {
  return kind === "suppliers" ? (
    <SupplierEditor record={record as Supplier | undefined} onClose={onClose} />
  ) : (
    <ServiceEditor
      record={record as Service | undefined}
      suppliers={suppliers}
      onClose={onClose}
    />
  );
}
function SupplierEditor({
  record,
  onClose,
}: {
  record?: Supplier;
  onClose: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const form = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: record
      ? {
          ...record,
          email: record.email || "",
          phone: record.phone || "",
          contact_name: record.contact_name || "",
          address: record.address || "",
          payment_terms: record.payment_terms || "",
          notes: record.notes || "",
        }
      : {
          name: "",
          kind: "hotel",
          email: "",
          phone: "",
          contact_name: "",
          address: "",
          payment_terms: "",
          notes: "",
        },
  });
  return (
    <form
      className="flex flex-col gap-5 rounded-xl border bg-card p-6"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await saveCatalog("suppliers", values, record?.id).catch(
          () => ({ error: "Unable to connect. Please try again." }),
        );
        if (result.error) setMessage(result.error);
        else {
          onClose();
          router.refresh();
        }
      })}
    >
      <h2 className="text-xl font-semibold">
        {record ? "Edit" : "New"} supplier
      </h2>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        {(
          [
            "name",
            "contact_name",
            "email",
            "phone",
            "address",
            "payment_terms",
            "notes",
          ] as const
        ).map((field) => (
          <Field key={field} data-invalid={!!form.formState.errors[field]}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="capitalize">
                {field.replaceAll("_", " ")}
                {field === "name" ? " *" : ""}
              </span>
              <Input
                {...form.register(field)}
                aria-invalid={!!form.formState.errors[field]}
                aria-describedby={`${field}-error`}
              />
            </label>
            <FieldError
              id={`${field}-error`}
              errors={[form.formState.errors[field]]}
            />
          </Field>
        ))}
        <label className="flex flex-col gap-1 text-sm">
          Supplier type
          <select className={selectClass} {...form.register("kind")}>
            {supplierKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </FieldGroup>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save supplier"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function ServiceEditor({
  record,
  suppliers,
  onClose,
}: {
  record?: Service;
  suppliers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: record
      ? {
          ...record,
          description: record.description || "",
          cost: moneyInput(Number(record.cost_minor), record.currency),
          selling: moneyInput(Number(record.selling_minor), record.currency),
          tax_rate: String(record.tax_rate),
          supplier_id: record.supplier_id || "",
        }
      : {
          name: "",
          description: "",
          category: "tour",
          supplier_id: "",
          currency: "USD",
          cost: "0.00",
          selling: "0.00",
          tax_rate: "0",
          is_active: true,
        },
  });
  return (
    <form
      className="flex flex-col gap-5 rounded-xl border bg-card p-6"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await saveCatalog("services", values, record?.id).catch(
          () => ({ error: "Unable to connect. Please try again." }),
        );
        if (result.error) setMessage(result.error);
        else {
          onClose();
          router.refresh();
        }
      })}
    >
      <h2 className="text-xl font-semibold">
        {record ? "Edit" : "New"} service
      </h2>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        {(["name", "description", "cost", "selling", "tax_rate"] as const).map(
          (field) => (
            <Field key={field} data-invalid={!!form.formState.errors[field]}>
              <label className="flex flex-col gap-1 text-sm">
                <span>
                  {
                    {
                      name: "Service name *",
                      description: "Description",
                      cost: "Cost price *",
                      selling: "Selling price *",
                      tax_rate: "Tax percentage *",
                    }[field]
                  }
                </span>
                <Input
                  {...form.register(field)}
                  inputMode={
                    ["cost", "selling", "tax_rate"].includes(field)
                      ? "decimal"
                      : undefined
                  }
                  aria-invalid={!!form.formState.errors[field]}
                  aria-describedby={`${field}-error`}
                />
              </label>
              <FieldError
                id={`${field}-error`}
                errors={[form.formState.errors[field]]}
              />
            </Field>
          ),
        )}
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <select {...form.register("currency")} className={selectClass}>
            {supportedCurrencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select {...form.register("category")} className={selectClass}>
            {supplierKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Supplier
          <select {...form.register("supplier_id")} className={selectClass}>
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("is_active")} />
          Available for new documents
        </label>
      </FieldGroup>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? "Saving…" : "Save service"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function CatalogRecords({
  kind,
  records,
  suppliers,
}: {
  kind: "suppliers" | "services";
  records: (Supplier | Service)[];
  suppliers: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<
    Supplier | Service | null | undefined
  >();
  const [confirm, setConfirm] = useState<string>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <Button onClick={() => setEditing(null)}>
        <Icon name="plus-lg" /> Add{" "}
        {kind === "suppliers" ? "supplier" : "service"}
      </Button>
      {editing !== undefined && (
        <CatalogEditor
          kind={kind}
          record={editing || undefined}
          suppliers={suppliers}
          onClose={() => setEditing(undefined)}
        />
      )}
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      {!records.length ? (
        <Empty className="border p-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="inbox" />
            </EmptyMedia>
            <EmptyTitle>No {kind} found</EmptyTitle>
            <EmptyDescription>
              Add a record or adjust your filters.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map((record) => (
            <article key={record.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{record.name}</h2>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    {"kind" in record ? record.kind : record.category}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(record)}
                  aria-label={`Edit ${record.name}`}
                >
                  Edit
                </Button>
              </div>
              {"kind" in record ? (
                <div className="mt-3 flex flex-col gap-1 text-sm">
                  <p>{record.contact_name || "No contact person"}</p>
                  <p className="break-all">
                    {record.email || "No email"} · {record.phone || "No phone"}
                  </p>
                  <p>Terms: {record.payment_terms || "Not set"}</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm(record.id)}
                  >
                    Delete supplier
                  </Button>
                  {confirm === record.id && (
                    <div className="mt-3 flex flex-col gap-2">
                      <p>
                        Delete {record.name}? Linked records prevent deletion.
                      </p>
                      <Button
                        disabled={busy}
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const result = await deleteSupplier(record.id);
                            setConfirm(undefined);
                            setMessage(result.error || "");
                            router.refresh();
                          } catch {
                            setMessage("Unable to connect. Please try again.");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Confirm delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm(undefined)}
                      >
                        Keep supplier
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-1 text-sm">
                  <p>
                    Cost: {record.currency}{" "}
                    {moneyInput(Number(record.cost_minor), record.currency)}
                  </p>
                  <p>
                    Selling: {record.currency}{" "}
                    {moneyInput(Number(record.selling_minor), record.currency)}
                  </p>
                  <p>
                    Tax: {record.tax_rate}% ·{" "}
                    {record.is_active ? "Active" : "Archived"}
                  </p>
                  <p>
                    Supplier:{" "}
                    {suppliers.find((s) => s.id === record.supplier_id)?.name ||
                      "None"}
                  </p>
                  <p className="text-muted-foreground">
                    Archive using Edit to retain document history.
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
