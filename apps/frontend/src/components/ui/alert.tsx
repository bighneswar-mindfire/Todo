import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("w-full rounded-lg border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "border-destructive/50 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div className={cn(alertVariants({ variant }), className)} {...props} />;
}
