export type ViewName = 'now' | 'today' | 'tenDays';

/** Shared by the phone tab bar and the desktop inline nav. */
export const NAV_ITEMS: Array<{ id: ViewName | 'more'; label: string }> = [
  { id: 'now', label: 'Ahora' },
  { id: 'today', label: 'Hoy' },
  { id: 'tenDays', label: '10 días' },
  { id: 'more', label: 'Más' },
];
