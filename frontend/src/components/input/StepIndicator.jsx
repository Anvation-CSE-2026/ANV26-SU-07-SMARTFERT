export function StepIndicator({ steps, current, onJump }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Form steps">
      {steps.map((step, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <button
            key={step.key}
            role="tab"
            aria-selected={active}
            onClick={() => onJump(i)}
            className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
              active
                ? "bg-green-600 text-white border-green-600"
                : done
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-green-700/60 border-green-100"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                active ? "bg-white/20" : done ? "bg-green-200" : "bg-green-50"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
