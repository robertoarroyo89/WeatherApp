'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchLocations } from '@/lib/weather/api';
import { locationSubtitle } from '@/lib/store/locations';
import type { GeoLocation } from '@/lib/weather/types';
import { Icon } from '@/components/ui/Icon';
import { ShimmerBar } from '@/components/now/CurrentHero';

type SearchState = 'idle' | 'loading' | 'done' | 'error';

/**
 * City search.
 *
 * Debounced and aborted per keystroke, and every result carries its region and
 * country — there are a great many places called Valencia, and a list of
 * identical names is worse than no search at all.
 *
 * The debounce lives in the change handler rather than in an effect: typing is
 * the event, so that is where the work belongs.
 */
export function LocationSearch({
  onSelect,
  autoFocus = false,
}: {
  onSelect: (location: GeoLocation) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    // Delayed so the sheet finishes animating before the keyboard arrives.
    const timer = setTimeout(() => inputRef.current?.focus(), 280);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      controllerRef.current?.abort();
    },
    [],
  );

  const run = useCallback(async (term: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const found = await searchLocations(term, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      setState('done');
    } catch {
      if (!controller.signal.aborted) setState('error');
    }
  }, []);

  const onChange = useCallback(
    (value: string) => {
      setQuery(value);
      clearTimeout(timerRef.current);
      controllerRef.current?.abort();

      const term = value.trim();
      if (term.length < 2) {
        setResults([]);
        setState('idle');
        return;
      }
      setState('loading');
      timerRef.current = setTimeout(() => void run(term), 260);
    },
    [run],
  );

  const message =
    state === 'error'
      ? 'No hemos podido buscar. Revisa la conexión.'
      : state === 'done' && results.length === 0
        ? 'No encontramos esa ciudad.'
        : null;

  return (
    <div>
      <div className="gutter">
        <div className="border-hairline flex items-center gap-3 border-b pb-3">
          <Icon name="search" size={18} className="text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onChange(event.target.value)}
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Busca una ciudad"
            aria-label="Busca una ciudad"
            className="placeholder:text-ink-faint w-full bg-transparent text-[1.0625rem] outline-none"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Borrar búsqueda"
              className="pressable text-ink-faint -mr-2 grid h-9 w-9 shrink-0 place-items-center"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {state === 'loading' && (
        <div className="gutter space-y-4 pt-6" aria-hidden>
          <ShimmerBar className="h-4 w-40" />
          <ShimmerBar className="h-4 w-52" />
          <ShimmerBar className="h-4 w-32" />
        </div>
      )}

      {message && (
        <p className="gutter text-ink-muted pt-6 text-[0.9375rem]" role="status">
          {message}
        </p>
      )}

      {results.length > 0 && (
        <ul className="pt-2">
          {results.map((location) => (
            <li key={`${location.id}-${location.latitude}`}>
              <button
                type="button"
                onClick={() => onSelect(location)}
                className="pressable gutter border-hairline flex min-h-[3.5rem] w-full items-center justify-between gap-4 border-b py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[1.0625rem]">{location.name}</span>
                  <span className="text-ink-faint block truncate text-[0.8125rem]">
                    {locationSubtitle(location)}
                  </span>
                </span>
                <Icon name="chevron-right" size={15} className="text-ink-faint shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
