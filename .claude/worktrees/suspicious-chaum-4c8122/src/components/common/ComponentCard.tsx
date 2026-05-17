interface ComponentCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  desc?: string;
  action?: React.ReactNode;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  title,
  children,
  className = "",
  desc = "",
  action,
}) => {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur-sm shadow-card transition-all duration-300 hover:shadow-card-hover dark:border-white/5 dark:bg-white/[0.03] ${className}`}
    >
      {/* Subtle gradient accent on top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px gradient-brand opacity-60" aria-hidden="true" />

      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white/90">
            {title}
          </h3>
          {desc && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {desc}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-white/5 sm:p-6">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
};

export default ComponentCard;
