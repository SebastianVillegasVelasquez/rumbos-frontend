import type { HTMLAttributes } from "react";

export const Card = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div
        className={`rounded-lg border border-ink/5 bg-surface shadow-soft ${className}`}
        {...props}
    />
);

type BadgeTone = "slate" | "sun" | "teal" | "leaf" | "coral";

const badgeTones: Record<BadgeTone, string> = {
    slate: "bg-slate-tint text-slate-dark",
    sun: "bg-sun-tint text-sun-dark",
    teal: "bg-teal-tint text-teal-dark",
    leaf: "bg-leaf-tint text-leaf-dark",
    coral: "bg-coral-tint text-coral-dark",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
}

export const Badge = ({ tone = "slate", className = "", ...props }: BadgeProps) => (
    <span
        className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${badgeTones[tone]} ${className}`}
        {...props}
    />
);
