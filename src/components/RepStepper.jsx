export default function RepStepper({ value, onChange, min = 1, max = 999, step = 1, label }) {
  const clamp = (n) => Math.min(max, Math.max(min, n))
  const current = Number(value)

  return (
    <div className="field grow">
      {label ? <label htmlFor={`stepper-${label}`}>{label}</label> : null}
      <div className="stepper">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(clamp((Number.isFinite(current) ? current : min) - step))}
        >
          −
        </button>
        <input
          id={label ? `stepper-${label}` : undefined}
          className="input"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={(e) => {
            const n = Number(e.target.value)
            onChange(Number.isFinite(n) && e.target.value !== '' ? clamp(n) : min)
          }}
        />
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(clamp((Number.isFinite(current) ? current : 0) + step))}
        >
          +
        </button>
      </div>
    </div>
  )
}
