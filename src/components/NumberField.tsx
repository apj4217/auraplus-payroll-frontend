import { useState } from "react";

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
};

/**
 * A number input that never gets "stuck" showing a leading 0.
 *
 * The classic bug: binding <input type="number" value={someNumber}>
 * directly means that as soon as the field is cleared to type a new
 * value, the empty string becomes Number("") = 0, which immediately
 * re-renders the input back to "0" - making it impossible to clear
 * the field and type a fresh number normally.
 *
 * The fix: keep the field's on-screen text in its own local string
 * state, decoupled from the numeric value after the first render.
 * The user can freely clear/retype; onChange still reports a proper
 * number (0 while the field is empty) to the parent form.
 */
export default function NumberField({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  error,
  min = 0,
  max,
  step = 1,
}: NumberFieldProps) {
  const [text, setText] = useState<string>(
    value || value === 0 ? String(value) : ""
  );

  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        className={`input ${error ? "input-error" : ""}`}
        type="number"
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          onChange(raw === "" ? 0 : Number(raw));
        }}
        onBlur={() => {
          // If the user leaves the field empty, show 0 explicitly
          // once they move away, instead of leaving it blank forever.
          if (text === "") {
            setText("0");
            onChange(0);
          }
        }}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
