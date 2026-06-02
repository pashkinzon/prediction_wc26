import { useCallback, useEffect, useState } from 'react';

export function useLocalStorageState<T>(
  readValue: () => T,
  writeValue: (value: T) => void,
) {
  const [value, setValue] = useState<T>(() => readValue());

  useEffect(() => {
    setValue(readValue());
  }, [readValue]);

  const updateValue = useCallback(
    (nextValue: T) => {
      writeValue(nextValue);
      setValue(nextValue);
    },
    [writeValue],
  );

  return [value, updateValue] as const;
}
