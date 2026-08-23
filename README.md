# Atmos

**El tiempo, pero como una atmósfera.** A weather app for iPhone where the
interface _is_ the weather: the sky relights itself through the day, thickens
when it clouds over, and rains when it rains.

Built as a Progressive Web App — install it from Safari with _Añadir a pantalla
de inicio_ and it opens without browser chrome, keeps working offline, and looks
like it belongs on the home screen.

The entire user interface is in Spanish from Spain. Code, comments and this
document are in English.

---

## The idea

Most weather apps are a table of numbers with a picture behind it. Atmos inverts
that: the atmosphere is the primary interface and the numbers are annotations on
it.

Opening the app at 07:00 does not look like opening it at 14:00, at 19:30 or at
midnight. Opening it in a downpour does not look like opening it under a clear
sky. The sky is not a set of stock backgrounds picked by an `if` statement — it
is computed, per frame, from the sun's real elevation above the horizon and the
current conditions.

Three things carry the product:

**A real solar model.** `lib/weather/solar.ts` implements the NOAA solar
position algorithm. Everything visual keys off the sun's elevation rather than
the clock, which is why the app behaves correctly at any latitude on any date —
including polar day and polar night, where sunrise and sunset simply do not
exist.

**A composable palette rather than fixed themes.** Two complete palettes — a
clear sky and a closed overcast one — are keyframed against sun elevation and
interpolated in Oklab. Real weather is a blend of the two driven by cloud cover,
then darkened by precipitation and veiled by haze. There are no hardcoded
gradients and no discrete states to jump between.

**A time scrubber.** Drag through the next twenty-four hours and the whole app
follows: the sky relights, the sun moves along its arc, cloud thickens, rain
starts, the temperature counts up or down and the summary rewrites itself. No
network request is made while dragging — every hour is already in memory.

---

## Screenshots

> Add captures here. Suggested set:
>
> |                                          |                                         |
> | ---------------------------------------- | --------------------------------------- |
> | `docs/now-clear.png` — clear afternoon   | `docs/now-night.png` — clear night      |
> | `docs/now-rain.png` — heavy rain         | `docs/scrubber.png` — mid-drag          |
> | `docs/ten-days.png` — 10-day range bars  | `docs/activities.png` — activity scores |
> | `docs/desktop.png` — desktop composition | `docs/sun.png` — sun arc                |

---

## Stack

|             |                                                                         |
| ----------- | ----------------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router, Turbopack)                                      |
| Language    | TypeScript, strict                                                      |
| UI          | React 19                                                                |
| Styling     | Tailwind CSS 4 + CSS custom properties                                  |
| Type        | Instrument Serif · IBM Plex Sans · IBM Plex Mono                        |
| Animation   | CSS only — transitions, keyframes, one `<canvas>`                       |
| Data        | [Open-Meteo](https://open-meteo.com) — forecast, air quality, geocoding |
| Tests       | Vitest                                                                  |
| Persistence | `localStorage`                                                          |

**Runtime dependencies: `next`, `react`, `react-dom`. That is the whole list.**

There is no animation library. Every transition is a CSS transition or keyframe,
which means it runs on the compositor and cannot stall behind a busy main
thread — this app originally used Framer Motion and the bottom sheet would
occasionally strand itself off-screen when the frameloop was throttled. CSS
cannot do that. The only imperative animation is the precipitation canvas, and
its simulation is a pure function with unit tests.

---

## Architecture

```
app/
  layout.tsx            metadata, viewport, fonts, service worker registration
  page.tsx              the single route
  manifest.ts           web app manifest
  globals.css           design tokens, @property registrations, scene keyframes

lib/
  weather/              the domain. Knows nothing about React.
    api.ts              Open-Meteo requests, typed errors
    transform.ts        provider response -> domain model (the only file that
                        knows Open-Meteo's field names)
    types.ts            CurrentWeather, HourlyPoint, DailyPoint, AirQuality…
    codes.ts            WMO code -> semantic WeatherKind + Spanish label
    solar.ts            NOAA solar position, moon phase, sky geometry
    sunTimes.ts         golden hour and blue hour, found by scanning elevation
    palette.ts          the sky palette engine
    scene.ts            forecast + instant -> SceneState (drives the renderer)
    precipitation.ts    rain and snow simulation, DOM-free and tested
    series.ts           slicing the hourly/daily series, rain confidence
    events.ts           "what is the next thing the weather will do?"
    summary.ts          deterministic Spanish copy generation
    activities.ts       activity suitability scoring
    bestTime.ts         generic "when is the good moment?" window search
  color/oklab.ts        sRGB <-> Oklab, perceptual mixing, WCAG contrast
  store/                external stores: weather, preferences, places, cache
  hooks/                useWeather, useNow, environment signals
  format.ts             Spanish formatting, in the forecast location's timezone

components/
  scene/                the atmosphere: sky, sun, moon, stars, cloud, haze,
                        precipitation, lightning, grain
  now/ forecast/ rain/ sun/ air/ activities/ location/ nav/ ui/ panels/ views/
```

### Data flows one way

```
Open-Meteo  ->  transform.ts  ->  WeatherBundle  ->  scene.ts  ->  SceneState
                                       |                              |
                                       v                              v
                              summary / events /              CSS custom
                              activities (copy)               properties
```

No component ever sees a provider response. No component fetches. `lib/weather`
has no React import in it, which is why the interesting logic is testable
without a renderer.

### The data layer is an external store, not React state

`lib/store/weatherStore.ts` is a plain module with a `subscribe`/`getSnapshot`
pair, read through `useSyncExternalStore`. Weather data genuinely _is_ an
external system — a network, a disk cache, a geolocation sensor — so React
subscribes to it rather than owning it. There is no "load on mount" effect
anywhere in the app: loading starts the first time something subscribes.

### Loading strategy

1. Paint the cached forecast immediately, however old it is.
2. If it is fresh (< 12 min), stop. No request at all.
3. Otherwise refresh behind the visible data.
4. If the refresh fails, keep showing the cache and surface a quiet notice.

A returning user sees real weather on the first frame. A user with no connection
sees the last forecast rather than an error page.

The cache stores _raw_ provider responses rather than transformed bundles:
Open-Meteo returns column-oriented arrays of numbers, which serialise to roughly
a tenth of the size of the equivalent array of hourly objects. Twelve days of
hourly data for several cities fits comfortably in `localStorage`.

### How the sky is drawn

The palette is computed in JavaScript and written to `<html>` as CSS custom
properties, registered with `@property` so the browser can _interpolate_ them.
Changing the weather is then a CSS transition on the compositor — no React
render, no repaint of the scene.

That is also what makes the scrubber cheap: dragging updates a handful of custom
properties per frame and nothing else.

Layer order is physical — sky, stars, moon, sun, cloud, haze, precipitation,
lightning, then the lens (grain, readability scrim) — because that is what makes
cloud read as being _in front of_ the sun and rain in front of the cloud.

Two details worth knowing:

- **Cloud** is a seamless `feTurbulence` field used as a CSS mask over a palette
  gradient, on an element twice the viewport's width, translated by exactly one
  mask tile. The loop is invisible and the animation is one compositor transform.
- **The readability scrim is solved, not guessed.** How dark the veil needs to be
  depends entirely on the sky behind it. `palette.ts` models the colour text will
  actually sit on and bisects for the lightest scrim that still clears a 4.6:1
  contrast ratio. Vivid skies keep a light veil; pale overcast ones get the veil
  they need. A test asserts this across 110 possible atmospheres.

### Spanish copy is generated, not templated per-string

`lib/weather/summary.ts` builds sentences from the numbers with gender agreement
against the daypart noun — _"Tarde calurosa y despejada"_, _"Mediodía caluroso y
despejado"_. It deliberately says one useful thing rather than every true thing:
_"Refrescará después de las 20:00"_ over _"Humedad relativa: 68 %"_.

No model, no API. Output is a pure function of the forecast, so the same weather
always reads the same way.

---

## Getting started

Requires Node 20.9+ (developed on Node 26).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

| Script                            |                            |
| --------------------------------- | -------------------------- |
| `npm run dev`                     | dev server                 |
| `npm run build`                   | production build           |
| `npm start`                       | serve the production build |
| `npm run lint`                    | ESLint                     |
| `npm run typecheck`               | `tsc --noEmit`             |
| `npm test`                        | Vitest, once               |
| `npm run test:watch`              | Vitest, watching           |
| `node scripts/generate-icons.mjs` | regenerate the PWA icons   |

### Environment variables

**None.** Open-Meteo's free tier needs no API key, and there is no backend, no
database and no analytics. There is nothing to configure and no `.env` to create.

If you later swap in a provider that needs a key, `lib/weather/api.ts` is the
only file that would change.

---

## Weather data

All data comes from [Open-Meteo](https://open-meteo.com) (CC BY 4.0), called
directly from the browser — it is CORS-enabled and keyless, so there is no proxy
route and no serverless cold start.

| Endpoint                                        | Used for                                   |
| ----------------------------------------------- | ------------------------------------------ |
| `api.open-meteo.com/v1/forecast`                | current, hourly (12 days), daily (11 days) |
| `air-quality-api.open-meteo.com/v1/air-quality` | European AQI, particulates, pollen         |
| `geocoding-api.open-meteo.com/v1/search`        | city search                                |

Everything is requested in one canonical unit system (Celsius, km/h, metres) and
converted for display, so the cache is unit-independent and switching units never
triggers a fetch.

Two notes learned the hard way:

- The air-quality `domains` parameter is deliberately **not** set. Pinning it to
  `cams_global` returns `null` for every pollen species even in Europe, and a
  less accurate AQI there too.
- The daily `weather_code` is the worst code of the whole 24 hours, including the
  middle of the night. Used literally it labels a bright afternoon _"cielo
  cubierto"_ because it was overcast at 04:00. `transform.ts` derives the day's
  condition from its **daylight hours** instead.

### Reverse geocoding

Turning device coordinates into a place name uses
[BigDataCloud](https://www.bigdatacloud.com)'s keyless client endpoint.
Coordinates are rounded to two decimals (~1 km) before they leave the device:
enough to name a town, deliberately not enough to point at a street. If the
lookup fails the app falls back to _"Mi ubicación"_ and the forecast is
unaffected.

---

## Privacy

- Saved places and preferences live in `localStorage` on the device. Nothing is
  uploaded.
- No accounts, no backend, no analytics, no cookies.
- Geolocation is requested only after you press _Usar mi ubicación_, never on
  load, and only rounded coordinates are sent — to Open-Meteo for the forecast
  and to BigDataCloud for the place name.
- Declining location permission leaves the app fully usable via city search.

---

## Installing on iPhone

1. Open the deployed URL in **Safari** (not Chrome — only Safari can install to
   the home screen on iOS).
2. Tap the **Share** button.
3. Choose **Añadir a pantalla de inicio**.

It then launches standalone: no address bar, portrait-locked, correct spacing
around the Dynamic Island and the home indicator, and a launch background that
matches the darkest sky in the palette so there is no white flash.

`theme-color` is updated at runtime to the sky's current zenith. This is what
makes the app actually reach the top of the screen: iOS paints the strip behind
the status bar with `theme-color`, so a fixed value sits there as a flat band
with a visible seam where the real sky begins — most obvious at night, when a
static navy meets an almost-black zenith. Following the sky makes the band and
the sky the same colour and the seam disappears. On Android the same tag tints
the system bars, for the same reason.

After forty seconds of real use, an iOS user browsing in Safari sees a one-time
hint explaining this. It appears once, is dismissible, and never returns. Safari
exposes no programmatic install, so the app explains the actual gesture instead
of offering a button that cannot work.

### Offline

A service worker (`public/sw.js`) caches the app shell and immutable build
assets. It deliberately does **not** cache forecast responses — those have their
own freshness rules in `localStorage`, and two caches disagreeing about what
"current" means is worse than one.

Offline, the app opens and shows the last forecast it downloaded, labelled with
the time it was fetched.

---

## Deploying to Vercel

Zero configuration.

1. Push to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Deploy.

Vercel detects Next.js. There are no environment variables, no build settings to
change and no runtime to select — every route is static, and the only server-side
work is a cache-control header on `/sw.js` (see `next.config.ts`) so clients are
never stuck on an old precache manifest.

Any static-capable host works, but nothing here requires a platform other than
Vercel.

---

## Design notes

The brief asked for something that does not look like an existing weather app,
and the first pass failed that test: it had drifted onto a centred giant numeral
with the condition and "sensación" stacked beneath it, a soft sky gradient and an
iOS tab bar. Recognisably Apple Weather with a different palette. This is the
second pass.

The language it settled on is **an atmospheric editorial instrument**: a
magazine spread crossed with a measuring device.

**Type does most of the work.** Three faces, three jobs:

|                  |                                             |
| ---------------- | ------------------------------------------- |
| Instrument Serif | the temperature, headlines, activity scores |
| IBM Plex Sans    | interface and prose                         |
| IBM Plex Mono    | every readout, label, tick and qualifier    |

A high-contrast display serif at 130 px is the single decision that stops the
app looking like a system app. The system stack is deliberately _not_ used —
`-apple-system` is exactly what makes a web app look like a native one.

**Lockups, not stacks.** The temperature sits large on the left with the
condition set in tracked mono caps hanging off its baseline on the right, then a
single ruled line carrying `SENSACIÓN 32° · MÁX 30° · MÍN 25°`. Asymmetric and
composed, rather than a centred column.

**Print furniture instead of cards.** Sections are contents entries — an index
number, a label, a rule spanning the gap, a right-aligned value:

```
01  PRÓXIMAS HORAS ─────────────────────────────  24 H
```

Supporting figures are a specification sheet with dotted leaders, which holds
six readings in the space one card would take:

```
VIENTO ···················· 9 km/h · NE · VIENTO FLOJO
HUMEDAD ··················· 71 % · ALGO HÚMEDO
ÍNDICE UV ················· 1 · BAJO
```

Navigation is an index, not a tab bar: numbered entries in mono caps separated by
hairlines, the active one marked by a small filled square. On a wide screen it
moves up into the header and the bottom bar disappears entirely.

**Other decisions that are load-bearing:**

_Two materials, not one._ `.material` is sheer, for chips floating on the sky.
`.panel` is opaque, for sheets carrying text you have to read — the hero
temperature behind a sheet is 130 px of near-white, and at any transparency low
enough to read a table through, it ghosts through and looks like a fault.

_No drawn horizon._ It was built and then cut. A hairline positioned by sun
elevation reads beautifully at some hours and rules straight through the middle
of the summary at others; the hero is anchored to the bottom of the viewport,
which leaves no band the line can occupy safely. Haze and the gradient carry the
depth instead.

_Motion is calm._ No bounce anywhere. Press feedback is 2 % of scale and nothing
else. Cloud takes over eight minutes to cross the screen — slow enough that you
read depth rather than movement.

_Everything stands down when it should._ Animation stops when the page is hidden,
when `prefers-reduced-motion` is set, when the user turns effects off, and when
there is nothing falling. Particle counts and canvas pixel ratio drop on low-end
devices.

_Activity scores are honest about what they are._ A practical convenience
indicator, not a validated model, and the app says so. High UV _lowers_ the beach
score rather than raising it, and every threshold lives in one file so the tuning
stays reviewable.

## Tests

```bash
npm test
```

207 tests over the parts where being wrong is invisible until it matters:

|                                                  |                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `solar.test.ts`                                  | solar position against known values; polar day/night                       |
| `palette.test.ts`                                | no black skies, smooth interpolation, text contrast across 110 atmospheres |
| `oklab.test.ts`                                  | round-trips, composability, monotonic ramps                                |
| `transform.test.ts`                              | timezone arithmetic, missing metrics, daily condition derivation           |
| `precipitation.test.ts`                          | draw-call batching, recycling, wind slant, sway                            |
| `events.test.ts`                                 | which change wins, and how it is phrased                                   |
| `summary.test.ts`                                | gender agreement, every weather kind, no dangling sentences                |
| `activities.test.ts`                             | scores stay in 0–10 across an extreme sweep; tuning behaviour              |
| `bestTime.test.ts`                               | window search, gaps in data, thresholds                                    |
| `format.test.ts`                                 | Spanish formatting in the forecast location's timezone                     |
| `series.test.ts` `scene.test.ts` `codes.test.ts` | slicing, sampling, normalisation                                           |

Presentational components are not unit tested; they were reviewed in a browser
across breakpoints and weather states.

---

## Accessibility

- Semantic HTML; the scrubber is a real `role="slider"` with arrow, `Home`/`End`
  and `Escape` support.
- Primary text clears 4.6:1 against every possible sky — enforced by the scrim
  solver and asserted in tests.
- `prefers-reduced-motion` disables parallax, drift and particles, and collapses
  transitions. The app stays beautiful; it just holds still.
- Touch targets are at least 44 px.
- Pinch-zoom is deliberately **not** disabled.
- Charts carry `role="img"` with a sentence describing what they show.
- Closed sheets are `inert`, so their contents cannot be tabbed into.

---

## Future work

Deliberately not built, but the architecture leaves room:

- Accounts and synced favourites — the store is already a module behind a
  `subscribe`/`getSnapshot` boundary, so the transport can change without the UI
  noticing.
- Push notifications and weather alerts.
- A native wrapper, widgets, Live Activities.

---

## Licence and attribution

Weather and air-quality data © [Open-Meteo](https://open-meteo.com), CC BY 4.0.
Reverse geocoding by [BigDataCloud](https://www.bigdatacloud.com).
