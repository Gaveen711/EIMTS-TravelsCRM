import { DocumentDetail } from "@/components/finance/document-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentDetail kind="bookings" id={id} />;
}
