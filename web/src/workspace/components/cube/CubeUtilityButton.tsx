import type { ComponentProps } from "react";
import { IconButton } from "../common/IconButton";

/** Keep the original Aa control as the source of truth for cube utilities. */
export function CubeUtilityButton({
  className = "",
  ...props
}: ComponentProps<typeof IconButton>) {
  return (
    <IconButton
      {...props}
      size="sm"
      className={`cube-utility-control ${className}`}
    />
  );
}
