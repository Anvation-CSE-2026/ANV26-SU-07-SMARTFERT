import { useTranslation } from "react-i18next";

export function Field({ label, helper, required, children, htmlFor }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-green-900 mb-1.5">
        {label}
        {!required && <span className="text-green-700/50 font-normal"> ({t("common.optional")})</span>}
      </label>
      {children}
      {helper && <p className="text-xs text-green-700/60 mt-1">{helper}</p>}
    </div>
  );
}

export function NumberInput({ id, value, onChange, min, max, step = 1, placeholder, unit }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none pr-14"
      />
      {unit && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-green-700/60">{unit}</span>
      )}
    </div>
  );
}

export function SelectInput({ id, value, onChange, options, placeholder }) {
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput({ id, value, onChange, placeholder, type = "text" }) {
  return (
    <input
      id={id}
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
    />
  );
}
