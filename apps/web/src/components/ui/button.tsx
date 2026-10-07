import { cn } from "@/lib/utils/cn";

export function Button({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
