'use client';

import { useEffect, useState } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { useIsIos, useStandalone } from '@/lib/hooks/useEnvironment';

/**
 * "Add to Home Screen" hint.
 *
 * Appears once, after forty seconds of actual use, never on load — and only when
 * it is true: on iOS, in a browser tab, for someone who has not dismissed it.
 * Safari exposes no programmatic install, so this explains the real gesture
 * rather than offering a button that cannot work.
 */
export function InstallHint() {
  const { preferences, updatePreferences, bundle } = useWeather();
  const isIos = useIsIos();
  const standalone = useStandalone();
  const [due, setDue] = useState(false);

  const eligible = isIos && !standalone && !preferences.installHintDismissed && Boolean(bundle);

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => setDue(true), 40_000);
    return () => clearTimeout(timer);
  }, [eligible]);

  const visible = due && eligible;

  return (
    <div
      className="hint fixed inset-x-0 z-40 flex justify-center px-[var(--gutter)]"
      data-open={visible ? 'true' : 'false'}
      aria-hidden={!visible}
      inert={!visible}
      style={{
        bottom: 'calc(var(--nav-space) + 0.625rem)',
      }}
    >
      {/* A stronger material than the app's default: this floats over live
          content, and a see-through hint reads as a rendering fault. */}
      <div
        className="border-hairline w-full max-w-md rounded-[var(--radius-md)] border p-4"
        style={{
          background: 'color-mix(in oklab, var(--sky-zenith) 94%, transparent)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          boxShadow: '0 12px 40px rgb(2 5 10 / 0.4)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.9375rem] font-medium">Llévate el tiempo contigo.</p>
            <p className="text-ink-muted mt-1.5 text-[0.8125rem] leading-relaxed">
              Toca{' '}
              <span className="inline-flex translate-y-[3px] px-0.5">
                <Icon name="share" size={14} />
              </span>{' '}
              y luego <span className="text-ink">Añadir a pantalla de inicio</span> para usar Atmos
              como una app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => updatePreferences({ installHintDismissed: true })}
            aria-label="No mostrar más"
            className="pressable text-ink-faint -mt-1 -mr-1 grid h-9 w-9 shrink-0 place-items-center"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
