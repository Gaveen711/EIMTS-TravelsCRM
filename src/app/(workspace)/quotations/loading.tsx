import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-label="Loading documents"
    >
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
