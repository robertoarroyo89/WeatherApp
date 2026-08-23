import { AtmosApp } from '@/components/AtmosApp';

/**
 * Single route.
 *
 * Every screen is a client-side view over one persistent atmospheric scene, so
 * navigating never re-mounts the sky or refetches the forecast. There is no SEO
 * argument for splitting an app like this across routes, and a real cost to
 * doing it: the weather would flicker on every transition.
 */
export default function Page() {
  return <AtmosApp />;
}
