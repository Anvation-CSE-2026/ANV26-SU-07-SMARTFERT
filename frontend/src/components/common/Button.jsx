const VARIANTS = {
  primary: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm",
  secondary: "bg-green-50 text-green-800 hover:bg-green-100 border border-green-200",
  ghost: "bg-transparent text-green-700 hover:bg-green-50",
  amber: "bg-amber-500 text-white hover:bg-amber-600",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
};

const SIZES = {
  sm: "text-sm px-3 py-1.5 min-h-[36px]",
  md: "text-sm sm:text-base px-4 py-2.5 min-h-[44px]",
  lg: "text-base sm:text-lg px-6 py-3.5 min-h-[52px]",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  as: Tag = "button",
  fullWidth = false,
  ...rest
}) {
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function IconButton({ children, className = "", label, ...rest }) {
  return (
    <button
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-full w-10 h-10 text-green-700 hover:bg-green-50 transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
