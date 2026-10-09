import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { CatalogRecords } from "@/components/catalog/catalog-records";
import { supplierKinds, type Supplier, type Service } from "./schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Query = Record<string,string|string[]|undefined>;
export async function CatalogPage({kind,searchParams}:{kind:"suppliers"|"services";searchParams:Promise<Query>}) {
 await requirePermission(kind);const params=await searchParams;const q=typeof params.q === "string"?params.q.trim().slice(0,160):"";const filter=typeof params.filter === "string"?params.filter:"";const rawPage=Number(params.page);const page=Number.isSafeInteger(rawPage)&&rawPage>0?Math.min(rawPage,10000):1;const size=12;const db=await createClient();
 let query=db.from(kind).select("*",{count:"exact"}).order("name").order("id");
 if(q)query=query.ilike("name",`%${q.replace(/[\\%_]/g,"\\$&")}%`);
 if(kind==="suppliers"&&supplierKinds.includes(filter as typeof supplierKinds[number]))query=query.eq("kind",filter);
 if(kind==="services"&&["active","archived"].includes(filter))query=query.eq("is_active",filter==="active");
 const {data,error,count}=await query.range((page-1)*size,page*size-1);
 const supplierResult=kind==="services"?await db.from("suppliers").select("id,name").order("name"): {data:[],error:null};
 const link=(p:number)=>`/${kind}?${new URLSearchParams({q,filter,page:String(p)})}`;
 return <div className="flex flex-col gap-6"><div><span className="eyebrow">Operations directory</span><h1 className="page-title">{kind==="suppliers"?"Suppliers":"Services catalog"}</h1><p className="mt-2 text-muted-foreground">{kind==="suppliers"?"Keep contacts and payment terms ready for every booking.":"Reusable costs, selling prices and tax rates for your travel documents."}</p></div><form className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row" action={`/${kind}`}><label className="flex-1 text-sm">Search by name<Input name="q" defaultValue={q} placeholder={`Search ${kind}`}/></label><label className="text-sm">Filter<select name="filter" defaultValue={filter} className="block h-10 w-full rounded-md border bg-background px-3 sm:w-40"><option value="">All {kind}</option>{kind==="suppliers"?supplierKinds.map(k=><option key={k} value={k}>{k}</option>):<><option value="active">Active</option><option value="archived">Archived</option></>}</select></label><Button className="self-end" type="submit">Search</Button><Link className="self-end py-2 text-sm underline" href={`/${kind}`}>Clear</Link></form>
 {error||supplierResult.error?<div role="alert" className="rounded-xl border p-6"><h2 className="font-semibold">Unable to load {kind}</h2><p className="mt-2 text-sm">Please refresh and try again. Check your database configuration if this continues.</p></div>:<><CatalogRecords kind={kind} records={(data||[]) as (Supplier|Service)[]} suppliers={supplierResult.data||[]}/><nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm"><span>{count||0} records · Page {page} of {Math.max(1,Math.ceil((count||0)/size))}</span><div className="flex gap-4">{page>1&&<Link href={link(page-1)} className="underline">Previous</Link>}{page*size<(count||0)&&<Link href={link(page+1)} className="underline">Next</Link>}</div></nav></>}
 </div>;
}

