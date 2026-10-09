import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Icon({ name, className, ...props }: ComponentProps<"i"> & { name: string }) { return <i aria-hidden="true" className={cn("bi", `bi-${name}`, className)} {...props} />; }
