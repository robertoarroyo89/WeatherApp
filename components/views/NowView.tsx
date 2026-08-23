'use client';

import { CurrentHero } from '@/components/now/CurrentHero';
import { DetailStrip } from '@/components/now/DetailStrip';
import { TimeScrubber } from '@/components/now/TimeScrubber';
import { ActivityTeaser, AirTeaser, RainTeaser, SunTeaser } from '@/components/now/Teasers';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { PanelName } from '@/components/AtmosApp';

/**
 * Home.
 *
 * On a phone: one continuous column, a full-height atmospheric hero, then
 * sections separated by hairlines and whitespace rather than by boxes. Reading
 * down it should feel like turning pages, not scanning a grid.
 *
 * On a desktop it becomes a composition rather than a long strip: the hero holds
 * still on the left, vertically centred against the sky, while the information
 * scrolls past on the right. Same language, different medium — and emphatically
 * not the phone layout stretched to 1400 px.
 */
export function NowView({ onOpenPanel }: { onOpenPanel: (panel: PanelName) => void }) {
  return (
    <div className="mx-auto w-full max-w-[88rem] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:px-8">
      <div className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:items-center">
        <CurrentHero />
      </div>

      <div className="lg:py-[16vh]">
        <section className="pt-2">
          <div className="gutter">
            <SectionHeading index="01" label="Próximas horas" meta="24 h" />
          </div>
          <div className="mt-5">
            <TimeScrubber />
          </div>
        </section>

        <section className="pt-9">
          <div className="gutter">
            <SectionHeading index="02" label="Ahora mismo" />
            <DetailStrip />
          </div>
        </section>

        <RainTeaser onOpen={() => onOpenPanel('rain')} />
        <SunTeaser onOpen={() => onOpenPanel('sun')} />
        <ActivityTeaser onOpen={() => onOpenPanel('activities')} />
        <AirTeaser onOpen={() => onOpenPanel('air')} />
      </div>
    </div>
  );
}
