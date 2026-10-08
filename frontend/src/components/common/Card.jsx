export function Card({ children, className = "", as: Tag = "div", ...rest }) {
  return (
    <Tag
      className={`bg-white rounded-2xl border border-green-100 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon }) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-2">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="shrink-0 text-green-600 text-2xl leading-none mt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-green-900 text-base sm:text-lg leading-snug">{title}</h3>
          {subtitle && <p className="text-sm text-green-700/70 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }) {
  return <div className={`p-4 sm:p-5 pt-2 ${className}`}>{children}</div>;
}
