import { DocumentList } from "@/components/finance/document-list";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DocumentList kind="quotations" searchParams={searchParams} />;
}
