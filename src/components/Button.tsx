import clsx from "clsx";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "accent" | "ghost";
type Size = "sm" | "md" | "lg";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-xl font-semibold transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "hover:-translate-y-0.5 active:translate-y-[1px]",
        "hover:shadow-md active:shadow-sm",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-base",
        size === "lg" && "px-6 py-3 text-lg",
       variant === "primary" &&
          "bg-gradient-to-r from-indigo-600 to-blue-600 text-white !important shadow hover:shadow-indigo-300 focus-visible:ring-indigo-600",
        variant === "secondary" &&
          "bg-gray-800 text-white shadow hover:shadow-gray-400 focus-visible:ring-gray-700",
        variant === "accent" &&
          "bg-emerald-500 text-white shadow hover:shadow-emerald-400 focus-visible:ring-emerald-500",
        variant === "ghost" &&
          "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-300",
        className
      )}
    >
      {children}
    </button>
  );
}