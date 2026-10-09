import { notFound } from "next/navigation";
import { requireManagePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { idSchema, emptyCustomer, type Customer, type CustomerInput } from "@/lib/customers/schema";
import { CustomerForm } from "@/components/customers/customer-form";
export default async function EditCustomer({params}:{params:Promise<{id:string}>}){await requireManagePermission("customers");const {id}=await params;if(!idSchema.safeParse(id).success)notFound();let record:Customer|null=null;let failed=false;try{const client=await createClient();const {data,error}=await client.from("customers").select("*").eq("id",id).maybeSingle();failed=!!error;record=data;}catch{failed=true;}if(failed)return <p role="alert">Customer could not be loaded. Try again.</p>;if(!record)notFound();const initial=Object.fromEntries(Object.keys(emptyCustomer).map(key=>[key,key==="tags"?record.tags.join(", "):record[key as keyof Customer]??""])) as CustomerInput;return <div className="max-w-3xl space-y-6"><h1 className="text-3xl font-semibold">Edit customer</h1><CustomerForm id={id} initial={initial}/></div>;}

