import { requireManagePermission } from "@/lib/auth/authorize";
import { CustomerForm } from "@/components/customers/customer-form";
export default async function NewCustomer() {
  await requireManagePermission("customers");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold">New customer</h1>
      <CustomerForm />
    </div>
  );
}
