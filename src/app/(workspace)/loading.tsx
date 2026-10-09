import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() { return <div role="status" aria-label="Loading workspace" className="flex flex-col gap-6"><Skeleton className="h-10 w-60" /><Skeleton className="h-64 w-full" /><span className="sr-only">Loading workspace…</span></div>; }
