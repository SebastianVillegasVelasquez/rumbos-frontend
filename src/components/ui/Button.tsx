import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors " +
    "transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

const variants: Record<Variant, string> = {
    primary:
        "bg-teal-dark text-white shadow-soft hover:bg-teal focus-visible:ring-teal-dark focus-visible:ring-offset-paper",
    secondary:
        "bg-surface text-ink border border-slate/30 hover:border-teal-dark/50 hover:text-teal-dark focus-visible:ring-teal-dark focus-visible:ring-offset-paper",
    ghost: "bg-transparent text-ink-soft hover:bg-surface-muted focus-visible:ring-teal-dark focus-visible:ring-offset-paper",
    danger: "bg-coral-dark text-white hover:brightness-105 focus-visible:ring-coral-dark focus-visible:ring-offset-paper",
};

const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "primary", size = "md", className = "", ...props }, ref) => (
        <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
    )
);
Button.displayName = "Button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ variant = "secondary", className = "", ...props }, ref) => (
        <button
            ref={ref}
            className={`${base} ${variants[variant]} h-11 w-11 min-h-[44px] min-w-[44px] rounded-pill ${className}`}
            {...props}
        />
    )
);
IconButton.displayName = "IconButton";
