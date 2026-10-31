'use client'

import { useEffect, useState } from 'react'

/**
 * PERF (F1): debounce nilai — dipakai untuk search input agar filtering
 * (yang me-render ulang tabel panjang) tidak jalan di setiap keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
