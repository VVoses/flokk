# Flokk

Lead a flock of sparrows through a year in a looping Nordic farmland. Open `index.html` in a browser:
no build step, no server, no runtime dependencies.

**Play:** hold the mouse (or a finger, or the arrow keys / WASD) where you want to fly; let go and the
flock lands on the nearest trees, wires, roofs or ground. Eat insects to grow the flock, hide in trees
(spruce in winter) from hawks by day and owls by night, and keep the flock fed until spring comes round
again. Space or Shift dashes, Escape or P pauses. Watch the weather: a gale pushes the flock about, a winter
storm drains it fast unless it roosts under cover, and in fog you see a hawk late, though it sees you late too.

*Hidden:* tap the little year bar (top right) three times quickly to pick a season. From the title
screen, the game then starts in that season, with a full year ahead.

## Design

[`DESIGN.md`](DESIGN.md) sets out what the game is trying to be (harsh rules, a soft and honest world) and a
checklist of principles for new work. Read it before adding anything to the world.

[`ARCHITECTURE.md`](ARCHITECTURE.md) sets out how the code is put together and why: the no-build/global-scope
constraint and what it buys, the frame loop, the world/season/rendering models, and the shared patterns
(movement helpers, the animal state-machine convention, the audio envelope shape) worth reusing rather than
reinventing. Read it before a change that touches more than one file.

## Code map

Canvas game. `index.html` holds the markup and loads plain scripts **in order**.
They share one global scope (no modules), so any file can read or assign any top-level `let`
from an earlier file, and a test can reach every variable from `page.evaluate`.

Rule for adding code: a file's *top-level statements* may only use things defined in earlier
files; function bodies can use anything, since they run after everything has loaded.

| file | what lives there |
|---|---|
| `core.js` | canvas, projection (`TILT`, `HZ`, `PY`), RNG `R`/`rnd`, periodic noise `pfbm`/`pfbmP`, `wrapX`/`wdx`, `DEV` hook |
| `world.js` | world state, `genLayout` (lake, road, rail route, farms `FARMS`/`YARDS`, fields, cabins, zones), `genWorld` (trees, hedges, bales, fences, poles), seam twins `buildGhosts`, field polygons; farms' plots are cut from one tract per farm (`plotsFor`) with balks, ditches and hedges between them in `DIVIDES` |
| `sprites.js` | tree sprites per season (`buildSprites`, `NV` variants) |
| `ground.js` | `paintGround` → wide canvas `GE` → seam-blended `G`; `paintField` (one field as a given kind); `paintFloor` (forest floor, bogs, rocks, flowers, tracks) |
| `audio.js` | WebAudio graph, animal voices (`animalCall`, `quack`, `baa`, `moo`, `bark`), ambience, `audioTick` |
| `music.js` | generative background music, one voice per season (`musicTick`) |
| `sky.js` | shoreline `shoreY`, ridges, clouds, boulders |
| `life.js` | `ANIMALS`, spawning, per-kind behaviour `updateAnimals`, passing flocks, smoke |
| `interact.js` | animals reacting to each other (mobbing, cat, dog, herds, ducks); `callAt` sound queue |
| `people.js` | the farmer's routine, the fisher, the occasional walker (people live in `ANIMALS` as `k:'human'`) |
| `rigs.js` | drawing: 3D flier rig (`LOOK`), quadruped specs (`QSPEC`) and leg IK, the 3D swimming duck (`drawDuck`, reads `a.wpitch`/`a.wroll` from the wave code), the small side-view animals (hare, corvids, heron, wild flock birds) on cards turned to their heading, `drawAnimal`, `animalPost`, `MOVES`/`BOUNDS` |
| `figure.js` | quadrupeds and people as 3D figures: ellipsoids and limbs in the figure's own frame, turned to its heading (`hd3`), projected and sun-lit (`ello`, `ellDraw`, `limb`); planted-foot gait (`footAt`); `drawQuad`, `drawCatSit`, `drawHuman` |
| `wild.js` | small wild flocks passing through (`WILD`, `WILD_SP`): starlings, linnets, fieldfares, snow buntings by season; they fly in, wheel, feed rolling across a field, get flushed by hawks and people, and move on |
| `light.js` | calendar `CAL`, sun, light overlay and lamps (`LIGHTS`, beams with `dir`), seasons (`applySeason`, crossfade `TRANS`), sky backdrop, how much it snows (`LIGHT.snow`), showers (`RAIN`/`updateWeather`; `drawRain` is the overcast wash and thunder flashes — off in winter), time-of-day grading (`KM`/`KE` keys, `applyGlaze`) |
| `grow.js` | the year moving inside each season: snow melting back in patches (`GROW` mask, south-facing first), straw greening, trees leafing out and dropping leaves (`growUnder`), fields sprouting, ripening and harvested one by one (`fieldStage`, stage kinds painted by `paintField`), first snow settling; `seasonP()` is how far through the season we are |
| `air.js` | light and air (`AIR`): morning mist over the lake and hollows, dew/frost/snow glints, light shafts at dawn and dusk; never at night |
| `weather.js` | moving weather (`WEATHER`): the wind veering and freshening (sets `WIND`), gales, gusts travelling across the land (`gustAt`, used by tree sway, the grass, sound, the flag and smoke); rain and snow falling through the world (`WEATHER.fall`) to rings on the water, splashes and the snow; leaves torn off in autumn; grazing animals turning their backs to a hard wind (`a.lee`, used by `figPost`); spindrift and blizzards (`WEATHER.storm`) in winter; fog banks lying among the trees. Drops, flakes and leaves go into the painter's list in bands by ground y and fog banks as slices (`weatherItems`, kinds 16 and 15), so what stands in front hides them; `drawFog` adds only a thin veil that closes the view down round the flock and shorten how far hawks see (`seeK`, `hawkSee`); a gale also pushes the flock (`windPush`) |
| `waves.js` | wind on open water (lakes, pond, fjord): a travelling wave height field whose amplitude follows the wind field (`gustAt`), shaded into the surface with crest lines, white caps and foam streaks; the lee of a shore stays calm; a hard wind greys the water and breakers run in along the fjord shore (`drawWaves`, `drawWaterMood`, called from `render`) |
| `yard.js` | farmyard props (`PROPS`): flagpole with pennant, woodpile, clothesline, wheelbarrow; `yardSpot` finds open ground |
| `station.js` | the roadside petrol station out front of its kiosk: flat canopy on pillars, pump island, price pylon, forecourt tarmac |
| `rail.js` | periodic track, trains: liveries, wagon types, detailed `drawCar` |
| `traffic.js` | sparse road traffic (car, van, tractor with trailer): `roadAt`, `drawVehicle`, headlights, shadows |
| `regions.js` | soft lake/valley/highland/town regions, roadside services, and field-access track generation |
| `routes.js` | road/lane/field-track journeys shared by vehicles, walkers and farm machinery; train-crossing yielding |
| `game.js` | game state `st`, seam recentring `worldShift`, energy, insects, perch assignment, input, UI overlays, particles |
| `flight.js` | hawks and owls, flock flight |
| `update.js` | `update(dt)`: one simulation step |
| `render.js` | `render()`: draws every copy of the looping world (`KS`), painter sort, shadows |
| `session.js` | versioned local saves and paused restore of an active flight |
| `main.js` | HUD, boot, frame loop |
| `dev.js` | test helpers, loaded only with `?dev` |

## Conventions
- World is `W`×`H`; x repeats every `W`. Static things live in `[0,W)`. The flock, hawks and camera
  may stray a little past the seam and are shifted back by `worldShift`; use `wdx(a,b)` for any
  distance between a flock-side thing and a world thing.
- Anything drawn goes through the per-copy loops in `render()`; culling uses `visG`/`visU` with the
  shifted `V`. Gameplay checks use `inView`, which is seam-aware.
- Perches and trees near the seam have twins (`p.gh`/`p.orig`) so lookups work across it.
- New ground-animal states that move must be added to `MOVES` (and `BOUNDS` if they run).
- Anything on foot moves with `groundStep` (via `walkTo`/`steerA`), which plans a route round the corners of any
  building in the way (`navPlan`); pick
  destinations with `inRectPt` or `pushOut` so they are never inside a footprint.
- An animal with `a.busy` is driven by `interact.js` (or `people.js`) and skipped by `updateAnimals`.
- Keep the world sparse: at most one road vehicle at a time, one farmer, one fisher, one walker.

## Tools
Headless tools need Python 3 with Playwright; lint and format need Node (`npm install` once).
- `npm run check` (or `sh tools/check.sh`): syntax-check every script, then load and start the game headless.
- `python3 tools/flows.py`: end-to-end test of every screen: title, play, pause, mute, game over, fly again,
  a full year, new land, resize, night, and a phone viewport with touch.
- `python3 tools/seasonpick.py`: checks the hidden season picker.
- `python3 tools/road_check.py [N]`: over N generated lands, fails if a farm lane runs alongside the road before
  turning in, or the road cuts through a farmyard.
- `python3 tools/seam_check.py [SEEDS]`: fails if the seam where the land repeats east-west shows as a line, in any
  season, hour or zoom or mid-crossfade (failing screenshots in `tools/out/seam/`).
- `python3 tools/weather_check.py [TAG]`: gusts, an autumn gale, rain on the lake, a winter storm, fog by day and night; frame times
  and weather state printed, screenshots in `tools/out/weather/`.
- `python3 tools/grow_check.py [TAG]`: plays a whole year headless and fails on any page error; contact sheets of one field
  through each season and of misty dawns in `tools/out/survey/`.
- `python3 tools/survey.py TAG`: a fixed land photographed across seasons, hours and places (contact sheets in `tools/out/survey/`).
- `python3 tools/seasons.py TAG [HOUR] [X,Y,ZOOM]`: one place in all four seasons; `tools/timelapse.py TAG SEASON "h1,h2,..."`:
  one place through a day; `tools/night.py TAG`: yard lamps, a car's headlights and the train at night.
- `npm run lint`: ESLint over all scripts as one program (so cross-file names resolve), reported per file.
- `npm run format`: Prettier over the game scripts, JavaScript test tools, stylesheet and page.
- `python3 tools/scene.py STEP...`: scripted run with the `?dev` helpers, e.g.
  `python3 tools/scene.py "js:dev.season(2)" "js:dev.to(1200,1500,1.2)" wait:2000 shot:autumn`
  Screenshots go to `tools/out/`. `TRACE.start(()=>[...])` records changes; read `TRACE.log`.
- `dev.*`: `to(x,y,zoom)`, `zoom(z)`, `calm()`, `season(s,hour)`, `grow(p)` (pin season progress 0..1), `hour(h)`, `find(kind)`, `hawk()`, `wild(species)`, `land()`, `weather({s, ang, fog})` (pin wind strength, direction, fog; no argument unpins), `stats()`.

## License

Copyright (c) 2026 Karl (VVoses). All rights reserved. See [LICENSE](LICENSE).
