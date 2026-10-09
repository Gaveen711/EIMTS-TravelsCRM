import { Skeleton } from "@/components/ui/skeleton";
export default function Loading(){return <div role="status" aria-label="Loading catalog" className="flex flex-col gap-4"><Skeleton className="h-12 w-60"/><Skeleton className="h-20 w-full"/><Skeleton className="h-64 w-full"/></div>;}

