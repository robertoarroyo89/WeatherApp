'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { LocationSearch } from './LocationSearch';
import { fetchQuickCurrent } from '@/lib/weather/api';
import { describeWeatherCode } from '@/lib/weather/codes';
import { isFavourite, locationKey, locationSubtitle, sameLocation } from '@/lib/store/locations';
import { temperatureValue } from '@/lib/format';
import type { GeoLocation } from '@/lib/weather/types';

interface Condition {
  temperature: number;
  icon: string;
}

/**
 * Places.
 *
 * The current location, then favourites with live temperatures, then recent
 * searches, then search. Favourites are fetched with a three-field request each
 * rather than a full forecast, so opening this costs almost nothing.
 */
export function LocationSheet({ onClose }: { onClose: () => void }) {
  const {
    locations,
    location,
    selectLocation,
    toggleFavourite,
    preferences,
    requestLocation,
    locating,
  } = useWeather();
  const [mode, setMode] = useState<'list' | 'search'>('list');
  const [conditions, setConditions] = useState<Record<string, Condition>>({});

  const listed = useMemo(
    () => [
      ...(location ? [location] : []),
      ...locations.favourites.filter((item) => !sameLocation(item, location)),
    ],
    [location, locations.favourites],
  );

  // Identity of the *set* of places, so the fetch re-runs when a favourite is
  // added or removed but not on every unrelated render.
  const listedKey = useMemo(() => listed.map(locationKey).join('|'), [listed]);

  useEffect(() => {
    if (mode !== 'list' || listed.length === 0) return;
    const controller = new AbortController();

    void Promise.all(
      listed.map(async (item) => {
        const quick = await fetchQuickCurrent(item.latitude, item.longitude, controller.signal);
        if (!quick || controller.signal.aborted) return;
        setConditions((previous) => ({
          ...previous,
          [locationKey(item)]: {
            temperature: quick.temperature,
            icon: describeWeatherCode(quick.weatherCode, quick.isDay).icon,
          },
        }));
      }),
    );

    return () => controller.abort();
    // `listed` is derived from `listedKey`; depending on the key keeps this to
    // one request per real change.
  }, [mode, listedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'search') {
    return (
      <div className="pb-6">
        <LocationSearch
          autoFocus
          onSelect={(found) => {
            selectLocation(found);
            onClose();
          }}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      {listed.length > 0 && (
        <ul>
          {listed.map((item) => {
            const key = locationKey(item);
            const condition = conditions[key];
            const active = sameLocation(item, location);
            return (
              <li key={key} className="border-hairline flex items-stretch border-b">
                <button
                  type="button"
                  onClick={() => {
                    selectLocation(item);
                    onClose();
                  }}
                  className="pressable flex min-h-[4rem] flex-1 items-center gap-3 py-3 pl-[var(--gutter)] text-left"
                >
                  {/* The active marker leads the row rather than floating
                      between the temperature and the star, where it read as an
                      unlabelled third control. */}
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: active ? 'var(--accent)' : 'transparent' }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {item.fromDevice && (
                        <Icon name="locate" size={13} className="text-ink-faint shrink-0" />
                      )}
                      <span className="truncate text-[1.0625rem]">{item.name}</span>
                      {active && <span className="sr-only">(ubicación activa)</span>}
                    </span>
                    <span className="text-ink-faint block truncate text-[0.8125rem]">
                      {locationSubtitle(item) || 'Ubicación actual'}
                    </span>
                  </span>
                  {condition ? (
                    <span className="flex items-center gap-2.5">
                      <WeatherIcon name={condition.icon} size={18} className="text-ink-faint" />
                      <span className="tnum text-[1.375rem] font-light">
                        {temperatureValue(condition.temperature, preferences.temperatureUnit)}°
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-faint text-[0.8125rem]">—</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavourite(item)}
                  aria-label={
                    isFavourite(locations, item) ? 'Quitar de favoritos' : 'Guardar en favoritos'
                  }
                  className="pressable text-ink-faint grid w-14 shrink-0 place-items-center"
                >
                  <Icon name={isFavourite(locations, item) ? 'star-filled' : 'star'} size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {locations.recents.length > 0 && (
        <div className="pt-7">
          <h3 className="gutter section-label pb-2">Recientes</h3>
          <ul>
            {locations.recents.map((item) => (
              <li key={`recent-${locationKey(item)}`}>
                <button
                  type="button"
                  onClick={() => {
                    selectLocation(item);
                    onClose();
                  }}
                  className="pressable gutter flex min-h-[3rem] w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem]">{item.name}</span>
                    <span className="text-ink-faint block truncate text-[0.75rem]">
                      {locationSubtitle(item)}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={14} className="text-ink-faint shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="gutter mt-8 space-y-3">
        <button
          type="button"
          onClick={() => setMode('search')}
          className="pressable material flex min-h-[3rem] w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] text-[0.9375rem]"
        >
          <Icon name="search" size={16} />
          Buscar otra ciudad
        </button>
        <button
          type="button"
          onClick={() => {
            void requestLocation().then(onClose);
          }}
          disabled={locating}
          className="pressable text-ink-muted flex min-h-[3rem] w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] text-[0.9375rem] disabled:opacity-60"
        >
          <Icon name="locate" size={16} />
          {locating ? 'Buscando…' : 'Usar mi ubicación'}
        </button>
      </div>
    </div>
  );
}

export type { GeoLocation };
