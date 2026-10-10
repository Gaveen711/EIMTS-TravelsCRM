import { DocumentEditor } from "@/components/finance/document-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentEditor kind="bookings" id={id} />;
}
