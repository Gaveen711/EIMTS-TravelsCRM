import { CatalogPage } from "@/lib/catalog/page";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage kind="suppliers" searchParams={searchParams} />;
}
