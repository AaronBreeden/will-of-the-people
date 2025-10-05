import { ReactNode } from "react";
import clsx from "clsx";

/**
 * Consistent Card component with rounded corners, shadows, and hover effects.
 * Neutral background with subtle depth.
 */
export default function Card({
  children,
  className,
  interactive = true,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={clsx(
        "relative bg-white rounded-2xl p-6 border border-gray-200 shadow-sm",
        "transition-all duration-300 ease-out",
        interactive &&
          "hover:shadow-md hover:-translate-y-0.5 hover:rotate-[0.25deg] active:translate-y-[1px] focus-within:ring-2 focus-within:ring-indigo-600",
        className
      )}
    >
      {children}
    </div>
  );
}