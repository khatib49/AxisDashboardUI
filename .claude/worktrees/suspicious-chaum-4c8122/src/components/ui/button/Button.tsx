import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "outline" | "ghost" | "danger" | "gradient";
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}) => {
  const sizeClasses = {
    sm: "px-3.5 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-sm",
  };

  const variantClasses = {
    primary:
      "bg-brand-600 text-white shadow-theme-sm hover:bg-brand-700 hover:shadow-glow-brand active:scale-[0.98] disabled:bg-brand-300",
    gradient:
      "gradient-brand text-white shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-60",
    outline:
      "bg-white/70 backdrop-blur-sm text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-white hover:ring-brand-300 hover:text-brand-700 dark:bg-white/[0.03] dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white",
    ghost:
      "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
    danger:
      "bg-error-500 text-white shadow-theme-sm hover:bg-error-600 active:scale-[0.98] disabled:bg-error-300",
  };

  return (
    <button
      type={type}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;
