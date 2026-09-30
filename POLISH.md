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
- [x] Farm tractors travel between yards and fields; delivery and visitor journeys.
- [x] Multi-seed geometry and traffic regression checks.

## 5. Predator visuals and sound

- [ ] Inspect hawks, owls, and foxes in motion at gameplay scale.
- [x] Improve silhouette, anatomy, joints, banking, and material shading.
- [ ] Listen to each sound in isolation and in the mix; identify weak voices.
- [x] Refine envelopes, timbre, distance filtering, variation, and mix balance.

## 6. Regional expansion

- [x] Region rules for lake, valley, highland, and town; smooth boundaries.
- [x] Farm store and gas station with access, stopping places, and actual visitors.
- [ ] Regional wildlife, vegetation, building distributions, and ambience.
- [ ] Review density and performance before expanding world dimensions.

## Verification

- [x] Give saved-game title actions a stable primary/secondary layout and show each gameplay hint on its own line.
- [x] Keep insect pickup forgiving around the lead bird while limiting feeding-snap animation to non-player flock members.
- Seasonal regression: `node tools/transition_check.cjs` (requires Playwright).
  Set PLAYWRIGHT_MODULE and CHROMIUM_PATH to use existing local installations.
- Existing syntax, flow, seam, growth, and road checks remain relevant.
