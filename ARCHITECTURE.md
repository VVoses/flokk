# Flokk: architecture

Where [`DESIGN.md`](DESIGN.md) sets out what the game should feel like and [`README.md`](README.md) maps which
file holds what, this sets out *how the code is put together* and *why it's shaped that way* — the load-bearing
decisions a change should respect, and the recurring patterns worth reusing rather than reinventing.

## The one deliberate constraint: plain scripts, one shared scope, no build step

There is no bundler, no modules, no `import`/`export`, and (deliberately) no framework. `index.html` loads 35
game scripts in a fixed order (plus `dev.js` with `?dev` or `admin.js` with `?debug=1`). Every top-level
`const`/`let`/`function` in those plain scripts lands in the same shared scope. This is not an oversight —
it's what makes the rest of the toolchain possible:

- **Tests reach live state directly.** `tools/*.py` drive the game with Playwright and read or poke state with
  `page.evaluate("ANIMALS.find(a => a.k==='fox')")`, `page.evaluate("dev.season(2, 12)")`, and so on. There is no
  module boundary to punch through, no state to lift out of a closure first. `js/dev.js` (loaded only with
  `?dev`) is a thin `window.dev` wrapper around exactly this: it doesn't have privileged access, it just calls
  the same globals a test (or a future feature) would.
- **No build step to keep in sync.** Opening `index.html` *is* running the game. A contributor edits a file,
  reloads, and sees the change — no watch process, no source maps, no stale bundle.
- **Load order encodes one real rule**, stated in the README and worth restating here because it's easy to
  violate by accident: *a file's top-level statements may only use names defined in earlier files; function
  bodies may use anything*, since every function runs after the whole page has loaded. `const TD = {...}` at the
  top of `world.js` can't reference something defined in `light.js` (loaded later) — but a function in
  `world.js` can call a function in `light.js` freely, because by the time either runs, everything exists.

**What this means for a change:** don't introduce `class`, `import`, or a build tool to "clean up" a file —
that trades the test suite's ability to reach state for conventional encapsulation the game doesn't need. Do
feel free to extract a shared `function` or a shared data table; that's normal here and costs nothing. When you
add a new file, add its `<script>` tag in `index.html` in the right slot (after whatever it reads at its own
top level, before whatever reads it), and add one line to the table in `README.md`.

## The frame loop

`main.js` boots the game and drives a single `requestAnimationFrame` loop:

```
boot → genWorld(seed) → title screen
each frame → update(dt) → render()
```

`update(dt)` (in `update.js`) is the entire simulation step: calendar advance, weather, the flock's energy and
input, every animal's behaviour, hawks/owls, particles. `render()` (in `render.js`) draws the current state and
touches nothing that should persist — if a frame were skipped, gameplay wouldn't change. Keeping that split
strict is what makes the headless tools work at all: `tools/*.py` step `update` at whatever rate they like
(often much faster than real time) without the visuals lying about what state the game is actually in.

## World model: one strip that loops, not a grid

The land is `W` × `H`; static things (trees, buildings, fields, perches) live once in `x ∈ [0, W)`. The flock,
camera, hawks and weather may drift slightly past that range and get recentred by `worldShift` (`game.js`) —
`WX` tracks how far the world has been shifted under the flock so world-space math stays consistent.

- **Any distance between a flock-side thing and a world thing** must go through `wdx(a, b)` (`core.js`), which
  picks the shorter way round the seam. Plain subtraction is a bug waiting for a flock near `x=0` or `x=W`.
- **Perches and trees near the seam have twins** (`p.gh`/`p.orig`, built by `buildGhosts()` in `world.js`) so a
  lookup working from either side of the seam finds the same object.
- **World generation is layered inside `genWorld(seed)`:** `genLayout()` sets the lake, pond, road and rail,
  then chooses a north-to-fjord bekk. It places farms, services and fields clear of the water and records small
  road, rail and track crossings. `genWorld` scatters trees, hedges, bales, fences and poles onto that layout,
  then calls `buildGhosts()` for seam twins. Each stage assumes the previous one is complete; don't reorder them.
- **The seam must never show**, in any season, hour, zoom or crossfade — this is the one piece of rendering with
  its own regression suite (`tools/seam_check.py`), because a visible seam is exactly the kind of thing that's
  invisible in a quick look and glaring the moment someone actually plays.
- **The bekk is a different water scale from the lake and fjord.** `streamXAt` and `inWater` in `world.js` give
  placement and movement one clearance rule, with bridge decks passable at their crossings. `paintStream` in
  `ground.js` bakes the narrow bed and banks into seasonal ground. Open-water waves in `waves.js` are reserved
  for the lake, pond and fjord; the bekk uses seeded bed stones and local downstream ripple and foam trains
  (`drawStreamFlow` in `render.js`), with a quiet nearby ambience. The riffles skip bridge decks and narrow
  into the open channel in winter.

## Time and seasons: two clocks, and a rebuild that happens *once*, on the boundary

`CAL` (`light.js`) is the wall clock: `CAL.t` in seconds drives `CAL.day`, `CAL.hour`, `CAL.season`. `SEASON` is a
separate global — the season the *visuals* currently believe they're in — and the two are allowed to disagree
for exactly as long as a crossfade takes.

```
CAL.season ticks forward continuously
      │
      ▼ (update.js notices CAL.season !== SEASON)
applySeason(newSeason, smooth=true)
      │  SEASON flips immediately; TRANS.t resets to 0; BG_JOB starts rebuilding
      │  sprites/ground for the new season a little each frame (runBgJob, update.js)
      ▼
render() blends TRANS.prevG/prevSPR (frozen at the moment of the flip) against the
live G/SPR as TRANS.t eases 0→1 over ~10s (tEase()), after BG_JOB completes
```

The fade stays at zero until all incoming assets, including field and leaf growth stages, are ready.
The outgoing ground snapshot includes the live crop and snow overlays; rebuilding bushes and growth
stages yields between variants/fields. This avoids revealing a mixture of old and new assets.

Two details worth knowing before touching anything here, because both were real bugs:

- **Baked-per-season sprites and the live within-season overlay are different things, and a snapshot has to
  know that.** A tree's `SPR[type][v]` canvas is built *once*, at the start of its season, fully leafed. What
  actually shows on screen during that season is that sprite blended live, every frame, with a bare-branch
  overlay (`growUnder()` in `grow.js`, `drawBush`'s equivalent in `sky.js`) whose alpha depends on how far
  through the season it is (`seasonP()`). Late in autumn the *live* look is nearly bare even though the *baked*
  sprite is still fully green. `applySeason()`'s crossfade snapshot (`TRANS.prevSPR`) has to bake that same
  live blend in *before* freezing it (`leafFallSnap()`), or the outgoing tree flashes back to full leaf for the
  whole crossfade. If you add another live, per-frame overlay driven by seasonal progress, ask whether a
  crossfade snapshot of the thing it's drawn on needs the same treatment.
- **A value that's supposed to ease across a transition has to actually read the eased quantity**, not `SEASON`
  directly. `winterW()` (`lerp` between `TRANS.prevSeason` and `SEASON` through `tEase()`) exists specifically so
  code that cares "how wintery is it *right now*, mid-crossfade" doesn't have to reimplement that lerp — reach
  for it (or the same pattern) instead of branching on `SEASON === 3`.

`GROW` (`grow.js`) is the separate, continuous mechanism for change *within* a season: snow retreating in
patches, fields sprouting/ripening/being harvested one at a time, first snow settling. It reads `seasonP()`
every frame. Its live crop and snow overlays are captured in the outgoing ground snapshot at a season boundary,
but within a season they remain gradual and specific in a way the discrete sprite/ground rebuild can't be.

## Rendering: draw at a place, sort with everything else, let what's in front hide it

`render()` draws every visible copy of the looping world (`KS`), each copy's contents painter-sorted by depth
(`renderShadows`/the main sort in `render.js`), so a thing is never "on top" by virtue of draw order alone —
it's on top because it's genuinely nearer the camera at that point. `visG`/`visU` cull against the current
copy's shifted viewport `V`; gameplay code uses the separate, seam-aware `inView`. Two things that are easy to
get backwards:

- Screen-space effects (a fixed overlay, a full-screen tint that isn't standing in front of anything) read as
  cheap and are explicitly against the grain here (see `DESIGN.md` pillar 2) — when you want to show a
  phenomenon, show it through what it does to things at a place (trees lean in wind; snow lands on a roof and
  the roof hides it), not as a layer over the frame.
- Drawing logic is already split by *domain*, not by "big file, small file": `rigs.js` is the shared 3D flier
  rig, `figure.js` is quadrupeds/people as 3D figures, `sky.js` is bushes/clouds/shoreline, `yard.js`/`rail.js`/
  `traffic.js` are their own props. `grass.js` and `crops.js` feed blade strokes to `blades.js`, which uses
  WebGL2 when available and Path2D otherwise. Open-water waves similarly use a shader with a canvas fallback;
  `flocklight.js` adds a soft light under birds over forest. `render.js` itself stays large because painter-sorting
  requires knowing about every drawable kind in one place — that's an inherent cost of the sort, not
  disorganisation, so don't split it along an arbitrary line just to shrink it.

## Local flights and the title

`session.js` keeps at most six versioned localStorage slots. `claimSlot()` gives a new flight its own slot;
when full, it removes the oldest. `saveSession()` records the current run and a title summary, checks that
another tab has not changed the same slot, and reports whether the write succeeded. `restoreSession(id)`
rebuilds the seeded static world, verifies its signature and unpacks the dynamic state. An active flight
resumes play; a completed year returns to its year-end card.

The title has saved-flight and new-land views (`showTitle`); selecting **New flight** previews a land and
**Reroll** changes its seed before takeoff. The pause menu saves before returning to the title, and stays open
if that write fails. Its separate **New land** action attempts a save, then reloads into the land view. Death
clears only that flight's slot. Tests for these paths live in `session_check.py`
and `flows.py`.

## Animals and people: a shared movement toolkit, a per-kind behaviour switch

Every animal (and every person — farmer, fisher, walker — who is just `k: 'human'` in the same array) lives in
`ANIMALS` (`life.js`). `updateAnimals(dt)` runs a big `switch (a.k)` with one case per kind; each case reads and
writes only that animal's own fields plus the shared movement helpers:

| helper | for |
|---|---|
| `steerA(a, tx, ty, sp, dt, brake?, arrive?)` | move toward an explicit point, on foot or not, across the seam if that's shorter; on foot it's routed round buildings via `navPlan`/`groundStep`. `brake` (default 4) sets how early it decelerates on approach, `arrive` (default 2) how close counts as there |
| `walkTo(a, dt, sp)` | `steerA` toward `a.tx`/`a.ty` instead of an explicit point, with a gentler brake and looser arrive (3, 3) - the shape most on-foot wandering uses; returns whether it's arrived rather than the remaining distance |
| `flyTo(a, dt, sp, maxZ)` | anything airborne, straight-line with a climb-out |
| `steerTo(h, dt, x, y, maxTurn, gain)` | steering with a turn-rate and acceleration limit (hawks) - for something that banks and can't snap onto a new heading, not a ground animal |
| `inRectPt(r, m)` / `pushOut` | a random destination that's never inside a footprint |

`steerA`/`walkTo` used to be two separately-maintained copies of the same body (one in `interact.js`, one in
`life.js`) with slightly different tuning and, in `walkTo`'s case, a plain subtraction where `steerA` used
`wdx()` - a latent seam bug that never showed because on-foot targets are always local. `walkTo` is now a
one-line call into `steerA`. If you're tempted to copy either one for a new kind of movement, add a parameter
to `steerA` instead.

**The handoff convention**: an animal with `a.busy` is being driven by `interact.js` (mobbing, the cat, the
dog, herds, ducks) or `people.js`, and `updateAnimals` skips it outright — there's no dual ownership, no need to
merge two systems' opinions about where an animal should be. If you add a new kind of *interruption* (a new
predator, a new reason two animals interact), model it the same way: set `a.busy`, drive the animal from the
interrupting system, clear `a.busy` when it's done, and `updateAnimals`'s normal case is untouched. If you add a
new state that *moves* a ground animal, register it in `MOVES` (and `BOUNDS` if it runs) — code elsewhere
(sound, dust, threat-detection) assumes that list is complete.

**Reuse before duplicating**: `threatNear`, `rowStart`, `tractorMove`/`tractorTurn` and the perch/cover system
(`addPerch`, `perchesNear`, `coveredNow`, `exposed`) already answer "is something dangerous nearby," "where does
a field's row start," "how does a vehicle turn round at the end of a pass," and "is this thing hidden" — a new
animal that grazes a field, avoids traffic, or hides from hawks almost certainly wants one of these rather than
a fresh implementation.

## The flock, hunger, and hawks: small state machines over shared arrays

- `birds` holds the flock; `L` is the leader the camera follows and the player effectively steers. `st`
  (`game.js`) is everything else about the run: `energy`, `food`, `grace`, `stamina`, counters for the HUD.
- **Energy and growth are deliberately two separate ledgers that can pull apart.** `feed(v)` raises `st.energy`,
  scaled *down* as the flock grows (`v * 6 / max(6, birds.length)` — more mouths, thinner return per peck).
  `st.food` is a separate running total that spends into a new bird once it crosses `needFor(birds.length)`. Left
  alone, a flock can numerically keep "growing" while its actual energy trend is collapsing, because the
  growth threshold doesn't rise anywhere near as fast as the per-peck energy split shrinks. `tryGrow()` is the
  fix and the pattern to keep: it gates spending banked food on `st.energy` being above a floor, so a fragile
  flock banks food rather than growing itself into more mouths it can't feed. Any new "spend an accumulated
  resource on an irreversible flock change" should go through a similar health gate, not straight to the spend.
- **Hawks and owls are a small explicit state machine** (`flight.js`): `patrol → stalk → hover?/dive → climb →
  patrol`, or `→ carry`/`→ leave` on a catch or a giveup. Each state's `case` sets its own target velocity/pitch
  and decides the transition; `catchBird`/`foxCatch` are the two places a bird actually leaves `birds`, and both
  call `thud(kind, power, last)` — see below. Difficulty knobs live as named constants near the top of the
  relevant file (`HAWK_BOLD`, the grace/energy-drain numbers in `update.js`) specifically so they're easy to
  find and retune in isolation; keep new ones equally named and equally easy to find, not buried inline.

## Audio: build a small graph per sound, parameterize instead of branching in the caller

Nearly every sound function follows the same shape: create one or more `OscillatorNode`/`AudioBufferSourceNode`s,
run them through a filter, envelope the gain with `setValueAtTime`/`linearRampToValueAtTime`/
`exponentialRampToValueAtTime`, connect to `master` (or `verb` for reverb-tail sounds), `start`/`stop` with an
explicit end time. Nothing is left to the browser's default behaviour or garbage-collection timing.

`thud(kind, power, last)` is the model worth following for the *next* sound that needs to vary by context: one
function, a few named parameters the caller derives from its own state (a hawk's seasonal boldness, whether
this is the flock's last bird), rather than the caller building several near-duplicate variants or the sound
function reaching back into globals to figure out its own context. Every sound also takes small `rr(...)`
jitter on top of its parameters — per `DESIGN.md`, no call should come out exactly the same twice.

## Dev tooling: the same globals, from the outside

`js/dev.js` (only loaded with `?dev`) is `window.dev`: `to`, `zoom`, `calm`, `season`, `grow`, `hour`, `find`,
`hawk`, `wild`, `land`, `weather`, `stats` — each one just sets the same globals a normal frame would. There is
no separate "test mode" data path to keep in sync with the real one.

`tools/*.py` are headless Playwright drivers, each aimed at one concern: `flows.py` (every screen and mode
transition), `session_check.py` (saved flights), `seam_check.py` (the world-wrap, described above),
`road_check.py`/`stream_check.py`/`visual_smoke.py` (seeded geometry and rendered views),
`grow_check.py`/`weather_check.py` (season/weather regressions), `survey.py`/`seasons.py`/`timelapse.py`/`night.py`
(visual contact sheets for a human to actually look at — `DESIGN.md`'s "did you look at it?" is not rhetorical).
`render_diff.py --base /path/to/other/checkout` compares fixed seeded frames from two checkouts after a
rendering change.
`npm run lint` runs ESLint over every script *as one program* so cross-file globals resolve correctly; `npm run
format` is Prettier over `js/*.js`, `css/*.css`, `tools/*.{cjs,mjs}`, `index.html` (not the Markdown docs, including this one — match
the surrounding prose by hand). `sh tools/check.sh` is the fast smoke test: syntax-check every file, then
actually boot the game headless and confirm it starts.

## Adding a new thing, quickly

- **A new animal kind**: add it to `ANIMALS` (`spawnAnimals` in `life.js`), add its `case` to `updateAnimals`'s
  switch, reuse `walkTo`/`flyTo`/`inRectPt`/`threatNear` rather than rewriting them, register any new moving
  state in `MOVES`/`BOUNDS`, add its rig to `rigs.js` or `figure.js` depending on whether it's a flier or a
  quadruped/person, give it a voice in `audio.js` via `animalCall`/a dedicated function if its sound is truly
  distinct.
- **A new season-dependent visual**: decide up front whether it's a *discrete* per-season look (goes in the
  sprite/ground rebuild, needs a `TRANS.prevSPR`/`TRANS.prevG` crossfade path) or a *continuous* within-season
  change (goes through `GROW`, reads `seasonP()`, no baking or crossfade needed). Getting this choice right the
  first time avoids the leaf-fall class of bug above.
- **A new sound**: follow `thud`'s shape — parameters the caller derives from its own state, jitter built in,
  envelopes that fade rather than cut off (`DESIGN.md`: sound is ambience, not noise).
- **A new tool script**: headless Playwright, one concern, screenshots to `tools/out/<name>/` for anything
  visual, printed pass/fail for anything mechanical. Look at `fox_check.py` for the shortest template.
