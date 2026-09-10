# Checks

The measurements the docs and commit messages cite. They lived in a scratchpad
for most of Phase 2 and Part 3, which meant every "v26 23/23" and "0 differing
pixels of 59,223" in the history was unreproducible the moment that session
ended. They are here now.

None of this is a unit test suite. It is a set of instruments for a scene whose
correctness is mostly a question about pixels, camera poses and framing —
things that cannot be asserted from the outside without rendering them.

## Running

Playwright is **not** a dependency of the app, and deliberately: it is large and
nothing in the product needs it. Install it where you are running from.

```
npm i -D playwright && npx playwright install chromium
npm run build && npx next start -p 3100      # every script targets :3100
node checks/v26.mjs
```

Screenshots land in the directory you run from, not in `checks/` — `v26/`,
`wtn/`, `part3-<tag>/`. Those three are gitignored at the repo root, which is
where you will normally be.

## Tracing the camera

`app/nebula-probe.ts` publishes the rendered camera to `window.__nebulaProbe`
once per frame — position, heading, distance from the graph's centre, fov,
placement, and whether a flight is running. It exists because this README told
you to "trace the camera instead" and there was no way to: the r3f store is not
reachable from the page. It is not gated on `NODE_ENV`, because everything here
runs against a production build.

Read it from a `requestAnimationFrame` loop, not by polling from Node — a
flight is 2000ms and Playwright round-trips are slower than the thing being
measured. `exitflight.mjs` is the worked example.

Everything renders under SwiftShader (`--use-gl=angle --use-angle=swiftshader`),
so it runs anywhere and runs slowly — around 9fps. That is fine for anything
measured against *time* (flights are driven by `performance.now()`, so their
schedule is honest) and useless for judging how anything **feels**.

## What each one answers

| script | question |
| --- | --- |
| `v26.mjs` | Does routing still work? 23 checks: cold entry, back/forward, the panel's opacity through a flight, sideways navigation, reduced-motion redirects, panel sizing per tier, 404s, console errors. |
| `sweep.mjs` | Does anything throw or overflow? 6 routes × 5 viewports × reduced-motion — 60 combinations, checking for console errors, a missing canvas and horizontal scroll. |
| `baseline.mjs` + `part3diff.mjs` | **The pixel gate.** `node checks/baseline.mjs before`, change something, `node checks/baseline.mjs after`, `node checks/part3diff.mjs before after`. 5 routes × 6 viewports, reporting what fraction of inked pixels moved. |
| `worktonebula.mjs` + `wtndiff.mjs` | Is arriving at `/nebula` through a turned work page the same composition as arriving directly? **Read the caveat below before trusting it.** |
| `exitflight.mjs` | Does leaving the graph animate, and can you *see* it? Traces the camera and the document's opacity on the same frames. |
| `flightpath.mjs` | Does the graph stay centred while you fly in and out, or does it take a detour? Ink centroid per frame. Reports a **lower bound** — see the traps. |
| `dragguard.mjs` | Does the drag still spin the globe without eating the things around it — the landing click, article text selection, header links, and `/nebula`'s own camera drag. |
| `centres.mjs` | Does a work page's lit cluster land where the placement solve asked? Compares against the solve, not a literal. |
| `edgegap.mjs` | Do the spotlight labels clear their nodes, and each other? |
| `labelviewports.mjs` | How many labels survive at each viewport, and does any of them cross the article? |
| `exitcentre.mjs` | Does closing a node leave that node in the middle of the frame? |
| `overlay.mjs` | Do the DOM overlays sit on the graph the scene actually drew? |
| `mobile-survey.mjs` | What does every route look like on a phone? 8 routes × 4 viewports, errors and overflow, plus a tap-through from the landing cluster. |
| `outsideturn.mjs` | On a portrait phone, does a drag turn the globe with the camera staying on the axis, does closing a node face it, and is the turn forgotten once home? |
| `phonefade.mjs` | Is the graph visible through the hero page at both ends of a phone flight? Shot at DPR 2, because the DPR-1 harness draws phone-sized nodes too faint to judge. |
| `handoff.mjs` | Does the plane sit on the page at the moment of the hand-off home, in px? Desktop by default, `VIEWPORT=390x844` for the phone. |
| `workshot.mjs` | What does the spotlit work page look like at three desktop sizes, and how far is the camera? |
| `flyin.mjs` | Does flying in land at the centre, pass the hero, and hand the page over to the plane and back? Traces the camera, the hero plane and the document on the same frames, both directions, and saves what screenshots it can into `flyin/`. |
| `clickburst.mjs` | What is on screen in the frames right after the click, in both directions? A burst of screenshots into `burst/`, as fast as the harness can take them — a hundred milliseconds apart at best, so a one-frame glitch can still slip between them. |
| `focusshot.mjs` | What does an open node look like, cold and warm, and what happens when the pointer sits in a corner? Screenshots into `focus/`. |
| `interiorheading.mjs` | **Offline, no browser.** Which way should the reader face on arriving at the centre? Searches the sphere of headings against the shipping layout and prints the winner beside the rig's current `INTERIOR_HEADING`. Re-run whenever `content/layout.ts` moves. Needs the TypeScript loader: `node --experimental-strip-types --no-warnings --import ./checks/ts-register.mjs checks/interiorheading.mjs`. |

## Reading the app's own TypeScript

`ts-register.mjs` and `ts-loader.mjs` let a check import `@/lib/...` and
`content/...` directly — Node strips the types, the loader resolves the alias —
so a search over the layout runs against exactly what ships rather than a copy
of it. Nothing in the app depends on them.

## Traps

Every one of these cost a wrong conclusion at least once.

**A check that no longer tests what it says.** `worktonebula.mjs` reaches
`/nebula` from a work page with a *full page load*, because nothing on
`/work/[slug]` links to bare `/nebula` client-side — the only in-page way in is
a tech link to `/nebula/tech/[id]`, and closing that deliberately lands facing
the node you left. So it compares two cold loads and proves that a cold
`/nebula` is deterministic, which is worth knowing and is not the guarantee its
name claims. The orientation leak it was written to catch is not currently
reachable by any user path. It also spent several commits writing filenames its
own differ did not read, so it was passing by never running.

**Rebuilding while a check runs.** `next start` serves out of `.next`, so a
rebuild underneath it serves a half-written build and *everything* fails at
once. If a whole suite goes red, check this before believing it.

**Motion, when comparing pixels.** The wander runs on `/` and `/nebula`, so two
captures of the same build differ by up to 5.66%. `baseline.mjs` uses
`reducedMotion: 'reduce'` — which freezes the simulation, zeroes the parallax
and makes flights cuts — and hides everything that is not the canvas, because
the affordance label spawns at `Math.random()` positions. With both, two
captures of one build differ by 0.00%.

**Thresholding on the wrong channel.** Paper is `#F4EEE0`, whose blue channel is
224. A test for "has ink" written as `244 - min(r,g,b) > 8` counts the
background, and every frame reads as 100% covered. Use the red channel.

**Probing before the frame is applied.** `camera-controls` writes
`camera.position` during its own update, so reading it straight after a
`setLookAt` gives you wherever the camera *was*. Read the pose you applied, not
the camera. The same shape of mistake, one layer up: a probe placed before
`setPlacement` reports the previous frame's value and makes a smooth
interpolation look like a jump.

**Screencast frames during a route change.** Under software GL the canvas can
stall ~400ms while the route commits, so a captured frame may hold a fresh DOM
over a stale canvas. Trace the camera instead; do not judge a transition from
those frames.

**Measuring a flight from the click.** A route commit costs 80-240ms under
software GL before the rig's effect starts the flight. Measured from the click,
the departure looked like it did nothing for the first quarter and then lunged;
measured from the flight's own first frame it was the 44/70/91% it was
specified as. Find the first frame where `flying` is true and start there.

**Judging a flight by the camera alone.** The departure's camera schedule was
correct for as long as the departure was invisible: the destination document
painted over it 190ms in. A camera trace said the flight was fine and it was
fine — and it was also not being watched. Anything that claims a transition
works has to measure what was actually on screen.

**Beating a running animation with a plain declaration.** Holding the document
back for a flight set `opacity: 0` on everything but the canvas, and the
affordance's pulse ring ignored it: a running CSS animation outranks a normal
declaration in the cascade. Measured, it sat at 0.018 and rising through the
whole hold — visible as a ring around a graph that had not arrived. `computed
style, not the rule you wrote` is the check.

**Trusting a coarse sampler with a precise question.** `flightpath.mjs` wants
the worst excursion of the graph's on-screen centroid during a 2000ms flight,
and gets five or six samples: a screenshot forces a fresh composite of the
WebGL scene at ~9fps, so the cost is the round-trip, not the encoding. JPEG
instead of PNG bought nothing; dropping 1440x900 to 900x700 bought one frame.
Run to run it reports anywhere from 70 to 120px for the same build, because the
float simulation is still moving and the sample times land differently. The
precise number comes from evaluating `approachLerpPose` offline — it is pure
arithmetic over the layout — and the browser check exists to confirm the model
describes the shipping code, not to produce the figure.

**Writing the camera in the gap between a route commit and the rig's effect.**
The frame loop applied the standing pose whenever it was off `/nebula` with no
flight running, and there is at least one such frame — several under software
GL — between the commit that changes the route and the passive effect that
starts the departure. The camera was at its destination before the flight
began, so the flight started from where it was meant to end and did nothing;
`flyin.mjs` showed 130 units on the first flying frame. The rig now moves the
camera only once its own record of the route matches the prop.

**Stale expectations.** `centres.mjs` compared against a hard-coded `1008` for
several commits after the solve moved to `1102`, and read as a 95px regression
that did not exist. Where a check asserts a number the app also computes, have
it compute the number.
