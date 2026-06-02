type TimeOverrideProps = {
  value: string;
  effectiveNow: Date;
  onChange: (value: string) => void;
};

export function TimeOverride({
  value,
  effectiveNow,
  onChange,
}: TimeOverrideProps) {
  return (
    <section className="panel helper-panel">
      <div>
        <p className="eyebrow">Developer helper</p>
        <h2>Current time override</h2>
        <p className="muted">
          Effective time: {effectiveNow.toLocaleString()}
        </p>
      </div>
      <div className="time-controls">
        <input
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) => onChange(event.currentTarget.value)}
        />
        <button type="button" onClick={() => onChange('')}>
          Reset
        </button>
      </div>
    </section>
  );
}
