'use client';

import { useEffect, useState } from 'react';
import { WeatherScene } from '@/components/scene/WeatherScene';
import { useWeather } from '@/lib/hooks/useWeather';
import { SceneProvider } from '@/components/SceneProvider';
import { BottomNav, type ViewName } from '@/components/nav/BottomNav';
import { TopBar } from '@/components/nav/TopBar';
import { StatusBanner } from '@/components/StatusBanner';
import { NowView } from '@/components/views/NowView';
import { TodayView } from '@/components/views/TodayView';
import { TenDayView } from '@/components/views/TenDayView';
import { LocationOnboarding } from '@/components/onboarding/LocationOnboarding';
import { Sheet } from '@/components/ui/Sheet';
import { LocationSheet } from '@/components/location/LocationSheet';
import { RainPanel } from '@/components/panels/RainPanel';
import { SunPanel } from '@/components/panels/SunPanel';
import { AirPanel } from '@/components/panels/AirPanel';
import { ActivitiesPanel } from '@/components/panels/ActivitiesPanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { MorePanel } from '@/components/panels/MorePanel';
import { InstallHint } from '@/components/InstallHint';
import { ErrorState } from '@/components/ErrorState';
import { AppFooter } from '@/components/AppFooter';
import { useScrollProgress } from '@/lib/hooks/useScrollProgress';

export type PanelName = 'rain' | 'sun' | 'air' | 'activities' | 'settings' | 'more' | 'locations';

const PANEL_TITLES: Record<PanelName, string> = {
  rain: 'Lluvia',
  sun: 'Sol',
  air: 'Aire',
  activities: 'Actividades',
  settings: 'Ajustes',
  more: 'Más',
  locations: 'Tus sitios',
};

/**
 * Application root.
 *
 * The scene is mounted once, outside the view switcher, and everything else
 * scrolls over it — so changing screen never interrupts the weather you are
 * standing in. Views swap by key with a short lift; the secondary screens are
 * sheets over the same sky rather than separate pages.
 */
export function AtmosApp() {
  return (
    <SceneProvider>
      <WeatherScene />
      <AppShell />
    </SceneProvider>
  );
}

function AppShell() {
  const { hydrated, location, refresh, bundle, status } = useWeather();
  const [view, setView] = useState<ViewName>('now');
  // `panel` is whether the sheet is open; `panelContent` is what it contains.
  // They are separate so the content survives the closing animation instead of
  // vanishing halfway down the screen.
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [panelContent, setPanelContent] = useState<PanelName | null>(null);
  const { ref: scrollRef, node: scrollNode } = useScrollProgress(340);

  const openPanel = (next: PanelName) => {
    setPanelContent(next);
    setPanel(next);
  };
  const closePanel = () => setPanel(null);

  // A new view starts at the top; carrying scroll across screens feels broken.
  useEffect(() => {
    scrollNode?.scrollTo({ top: 0 });
  }, [view, scrollNode]);

  // "Ahora" is a view of the weather; the other two are views of data about it.
  // The atmosphere steps back on those, rather than glowing through a table.
  useEffect(() => {
    document.documentElement.style.setProperty('--view-dim', view === 'now' ? '0' : '0.5');
  }, [view]);

  if (!hydrated) {
    // The atmospheric gradient is already painted behind this: the loading state
    // is the sky, not a spinner.
    return null;
  }

  if (!location) {
    return <LocationOnboarding />;
  }

  // A failed load with nothing cached is the one case where there is genuinely
  // nothing to show. Everything else keeps the last forecast on screen.
  const fatal = status === 'error' && bundle === null;

  return (
    <>
      <TopBar
        onOpenLocations={() => openPanel('locations')}
        onOpenSearch={() => openPanel('locations')}
        view={view}
        onSelectView={setView}
        onMore={() => openPanel('more')}
        moreOpen={panel === 'more'}
      />
      <StatusBanner onRetry={() => refresh({ force: true })} />

      <main
        ref={scrollRef}
        className="scroll-y relative z-10 h-dvh pb-[calc(var(--nav-space)+1rem)] lg:pb-10"
      >
        {fatal ? (
          <ErrorState onChooseLocation={() => openPanel('locations')} />
        ) : (
          <>
            <div key={view} className="view-enter">
              {view === 'now' && <NowView onOpenPanel={openPanel} />}
              {view === 'today' && <TodayView />}
              {view === 'tenDays' && <TenDayView />}
            </div>
            <AppFooter onOpenSettings={() => openPanel('settings')} />
          </>
        )}
      </main>

      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-20 lg:hidden"
        aria-hidden
        style={{
          height: 'calc(var(--header-space) + 1rem)',
          background:
            'linear-gradient(to bottom, rgb(4 8 14 / 0.8) 0%, rgb(4 8 14 / 0.4) 55%, transparent 100%)',
          // Only while content is actually passing underneath. Left constant it
          // would darken the top of an otherwise pristine sky for no reason.
          opacity: 'calc(var(--scroll) * 1.8)',
        }}
      />

      {/* Content scrolls under the floating bar, so it needs somewhere to go:
          without this it is cut off dead straight by the bottom edge of the
          screen. Only on the phone — the desktop nav lives in the header. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 lg:hidden"
        aria-hidden
        style={{
          height: 'calc(var(--nav-space) + 1.5rem)',
          background:
            'linear-gradient(to top, rgb(4 8 14 / 0.9) 0%, rgb(4 8 14 / 0.55) 45%, transparent 100%)',
        }}
      />

      <BottomNav
        view={view}
        onSelect={setView}
        onMore={() => openPanel('more')}
        moreOpen={panel === 'more'}
      />

      <InstallHint />

      <Sheet
        open={panel !== null}
        onClose={closePanel}
        title={panelContent ? PANEL_TITLES[panelContent] : ''}
        full={panelContent === 'activities' || panelContent === 'locations'}
      >
        {panelContent === 'rain' && <RainPanel />}
        {panelContent === 'sun' && <SunPanel />}
        {panelContent === 'air' && <AirPanel />}
        {panelContent === 'activities' && <ActivitiesPanel />}
        {panelContent === 'settings' && <SettingsPanel />}
        {panelContent === 'locations' && <LocationSheet onClose={closePanel} />}
        {panelContent === 'more' && <MorePanel onSelect={openPanel} />}
      </Sheet>
    </>
  );
}
