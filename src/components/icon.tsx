import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Icon({
  name,
  className,
  ...props
}: ComponentProps<"svg"> & { name: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("icon", className)}
      fill="currentColor"
      viewBox="0 0 16 16"
      {...props}
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
