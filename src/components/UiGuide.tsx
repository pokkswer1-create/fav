"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Primary/secondary action with visible role text. */
export function ExplainedButton({
  label,
  hint,
  variant = "ghost",
  className = "",
  ...rest
}: {
  label: string;
  hint: string;
  variant?: "primary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`btn explained-btn ${variant} ${className}`.trim()}
      title={hint}
      {...rest}
    >
      <span className="explained-label">{label}</span>
      <em className="explained-hint">{hint}</em>
    </button>
  );
}

export function HowToPanel({
  title,
  steps,
  children,
}: {
  title: string;
  steps: string[];
  children?: ReactNode;
}) {
  return (
    <aside className="how-to-panel" aria-label={title}>
      <h2>{title}</h2>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {children}
    </aside>
  );
}
