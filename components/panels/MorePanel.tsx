'use client';

import { Icon } from '@/components/ui/Icon';
import type { PanelName } from '@/components/AtmosApp';

const ENTRIES: Array<{ id: PanelName; label: string; caption: string }> = [
  { id: 'rain', label: 'Lluvia', caption: '¿Va a llover, y cuándo?' },
  { id: 'sun', label: 'Sol', caption: 'Amanecer, luz dorada y UV' },
  { id: 'air', label: 'Aire', caption: 'Calidad del aire y polen' },
  { id: 'activities', label: 'Actividades', caption: 'Correr, playa, terraza, tender' },
  { id: 'settings', label: 'Ajustes', caption: 'Unidades y animaciones' },
];

/** The rest of the app, one tap from anywhere. */
export function MorePanel({ onSelect }: { onSelect: (panel: PanelName) => void }) {
  return (
    <ul className="pb-4">
      {ENTRIES.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={() => onSelect(entry.id)}
            className="pressable gutter border-hairline flex min-h-[4rem] w-full items-center justify-between gap-4 border-b py-3.5 text-left"
          >
            <span>
              <span className="block text-[1.0625rem]">{entry.label}</span>
              <span className="text-ink-faint block text-[0.8125rem]">{entry.caption}</span>
            </span>
            <Icon name="chevron-right" size={15} className="text-ink-faint shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}
