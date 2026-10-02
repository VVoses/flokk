# Flokk polish checklist

Work in priority order. Checked items are implemented; visual acceptance and larger changes remain explicit.

## 1. Seasonal continuity

- [x] Hold the crossfade until the incoming sprite, ground, and growth rebuild finishes.
- [x] Bake outgoing crop and snow overlays into the ground snapshot.
- [x] Spread bush, field-stage, and leaf-stage generation across frames.
- [x] Fade incoming autumn crops and tree rim lighting with the transition.
- [x] Preserve resident animal identities and routines across seasons; migrate visitors naturally.
- [x] Match perch protection to visible foliage.
- [ ] Visually inspect all boundaries, seams, snow, and low-end frame times.

## 2. Resume a session

- [x] Versioned localStorage save: seed, calendar, flock, resources, positions, and simulation state.
- [x] Continue / new game choice; restore paused and resume audio on user input.
- [x] Periodic and page-hide saves; handle invalid saves and unavailable storage.
- [x] Verify reload, closed-window return, death, and new-land behavior.
- [x] Detect newer saves from another tab, validate generated-world references, and warn when storage fails.

## 3. Ground movement

- [x] Acceleration, braking, turn limits, and gait synchronized with actual movement.
- [x] Species-specific idle, grazing, vigilance, and flight responses.
- [x] Test corners, fences, water, herd spacing, and the looping seam.

## 4. Roads and rail

- [x] Reject shallow crossings and long road–rail overlaps during generation.
- [x] Vehicles and walkers yield to trains.
- [x] Connected road/lane routes between actual destinations.
- [x] Shared gravel branches form a road hierarchy before splitting into individual approaches.
- [x] Merge field tracks before courtyards, keep minor tracks out of yards and water, and leave readable forest verges.
- [x] Mix signed level crossings with road-under-rail cuttings where the crossing angle allows it.
- [x] Enforce broad minimum-radius railway curves suitable for train speed and carriage length.
- [x] Farm tractors travel between yards and fields; delivery and visitor journeys.
- [x] Let tractors finish reaching a field at dusk instead of stopping on a public road.
- [x] Paint shared intersections once, gate every field approach, and park destination traffic in marked bays.
- [x] Keep public roads on field verges rather than through cultivated ground.
- [x] Multi-seed geometry and traffic regression checks.

## 5. Predator visuals and sound

- [ ] Inspect hawks, owls, and foxes in motion at gameplay scale.
- [x] Improve silhouette, anatomy, joints, banking, and material shading.
- [ ] Listen to each sound in isolation and in the mix; identify weak voices.
- [x] Refine envelopes, timbre, distance filtering, variation, and mix balance.

## Road visual audit

- [x] Remove spline overshoot that made short access roads curl or hook at their ends.
- [x] Separate public road, gravel lane, and field-track weight at whole-world zoom.
- [x] Give the public road a soft verge so it sits in the landscape instead of reading as a flat ribbon.
- [x] Route directly across shared access-road trunks instead of detouring to the public road and back.
- [x] Reduce repeated driveway teeth by sharing close farm and hamlet approaches where geometry permits.
- [x] Make junction mouths and courtyard arrivals read clearly without gravel blobs or stacked strokes.
- [x] Reserve clear approaches around public road–rail crossings before placing farms, churches, services, and hamlets.
- [x] Add occasional drainage, passing places, and roadside markers.
- [x] Carry verge drainage through access junctions with visible culverts.
- [x] Score field approaches by total distance back to the road so nearby network points cannot hide a large detour.
- [x] Keep roads clear of lake shores and churchyards, and widen their clearing through dense woodland.
- [x] Reserve access-road corridors before placing fields and reject unrelated roads through churchyards.
- [x] Shape the main road with broad coherent land warp while preserving smooth, fast vehicle travel.
- [x] Brake before access-road junctions and other sharp turns.
- [x] Animate arrival: engine shutdown, occupant exit, and walk away from the parked car.
- [x] Give more residents owned cars and marked home parking spaces.
- [x] Reject access-road reversals, self-intersections, and excessive detours; preserve valid direct farm and church lanes.
- [x] Silence parked vehicle engines and place parking bays deeper inside destinations.
- [x] Remove unused shared-road stubs and keep service parking clear of storefront walls.
- [x] Give the farm store three marked, reachable parking spaces on a gravel apron.
- [x] Park farm cars on a soft-edged gravel pad beside the house (planned at generation, never on a building), reached by ruts from the gate.

## 6. Regional expansion

- [x] Region rules for lake, valley, highland, and town; smooth boundaries.
- [x] Farm store and gas station with access, stopping places, and actual visitors.
- [x] Regional wildlife, vegetation, building distributions, and ambience.
- [x] Review density and performance before expanding world dimensions.

## Verification

- [x] Collapse repeated per-frame list traversals and compact transient simulation arrays in place.
- [x] Give saved-game title actions a stable primary/secondary layout and show each gameplay hint on its own line.
- [x] Keep insect pickup forgiving around the lead bird while limiting feeding-snap animation to non-player flock members.
- Seasonal regression: `node tools/transition_check.cjs` (requires Playwright).
  Set PLAYWRIGHT_MODULE and CHROMIUM_PATH to use existing local installations.
- Existing syntax, flow, seam, growth, and road checks remain relevant.
- Seeded visual smoke: `python3 tools/visual_smoke.py` captures whole-world, farm, and service views and checks shared-road connections, parking clearance, and rendered frame content.
