import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border rounded-lg p-6 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}
