import { useState } from 'react';

type FlagProps = {
  countryCode?: string;
  label: string;
};

export function Flag({ countryCode, label }: FlagProps) {
  const [hasError, setHasError] = useState(false);
  const normalizedCode = countryCode?.toLowerCase();

  if (!normalizedCode || hasError) {
    return (
      <span className="flag-tile flag-fallback" aria-label={`${label} flag unavailable`} role="img">
        TBD
      </span>
    );
  }

  return (
    <span className="flag-tile">
      <img
        alt={`${label} flag`}
        src={`/flags/${normalizedCode}.svg`}
        onError={() => setHasError(true)}
      />
    </span>
  );
}
