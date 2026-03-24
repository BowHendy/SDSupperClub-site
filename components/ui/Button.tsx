import { forwardRef } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "outline";
  children: React.ReactNode;
  className?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "outline", children, className = "", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded border px-4 py-2 font-geist text-body-sm transition-all duration-300 disabled:opacity-50";
    const variants = {
      ghost: "border-transparent hover:bg-white/10",
      outline: "border-foreground/60 hover:border-foreground hover:bg-foreground hover:text-background",
    };
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
