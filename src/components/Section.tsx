import { ReactNode } from "react";
import clsx from "clsx";

export default function Section({
  id,
  title,
  children,
  className,
  align = "left",
}: {
  id: string;            // used for scroll-to nav
  title: string;         // section heading
  children: ReactNode;   // content inside section
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <section
      id={id}
      className={clsx(
        "scroll-mt-24 py-20 border-b border-gray-200 last:border-none",
        className
      )}
    >
      <div className="max-w-4xl mx-auto px-6">
        <h2
          className={clsx(
            "text-3xl font-bold tracking-tight mb-6",
            align === "center" && "text-center"
          )}
        >
          {title}
        </h2>
        <div className={clsx(align === "center" && "text-center")}>
          {children}
        </div>
      </div>
    </section>
  );
}