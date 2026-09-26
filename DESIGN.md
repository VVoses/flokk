# Flokk: design and game philosophy

A living document. It sets down what flokk is trying to be, distilled from every note Karl has given on the game
so far, so that new work pulls in the same direction. When a change and this document disagree, one of them is
wrong: fix the change, or come back here and refine the principle.

## In one sentence

A year in the life of a small flock of sparrows in a Norwegian farm parish: **hard the way a year is hard, and
beautiful the way the land is beautiful.**

## The two halves

Flokk holds two things at once, and neither is allowed to eat the other.

**The rules are harsh.** Hunger is constant, hawks hunt by day and owls by night, and winter nights should be
genuinely frightening. Birds die, and the whole flock can die. There is no calm mode, no mode without predators,
and no mode without death. The end screens say *Starved* or *Taken*, plainly. We don't soften this, because the
danger is what makes the beauty count.

**The world is soft.** The land, the light and the sound should be a pleasure to be in: something pretty to look
at, the miracle of nature and how it emerges. Mist lifts off the lake at dawn, snow melts back from the
south-facing slopes first, the fields green, ripen and are cut one by one, and a flock of starlings comes wheeling
in over the stubble.

These halves don't conflict, because both come from the same place: **the world behaves like the real one.**
Real winter nights are frightening for a sparrow. Real spring mornings are astonishing. Flokk gets both by being
honest about nature, not by tuning a "fun" dial. Beauty is never a reward handed to the player, and danger is
never a punishment for stopping to look.

## Pillars

### 1. The world is honest

Everything should behave the way the real thing does, down to small details, because that is what immersion is
made of. Each of these was a bug precisely because it broke that honesty:

- Sparrows roost quietly at night. A flock chirping while hiding in the dark forest is wrong, and it also gives
  the hiding away.
- Animals call when a real animal would, and rest between calls. A moose that bellows every few seconds, or a
  flock of sheep that never stops bleating, is noise, not a place.
- Headlights shine forward from the nose of a car or train. Deer and moose bound when they run, and stay out of
  fenced pastures. A fence holds the animals it fences.
- Where a railway crosses a road there is a level crossing, and it works like one. Power poles carry their wires
  the way real lines do.
- Cover is real cover. A bird is hidden only while perched in dense foliage; bare birches in winter hide nothing,
  and only spruce does. Flying over the forest is still flying in the open.

The test: *would someone who grew up in rural Norway notice this is off?* If so, it's a bug.

### 2. Nothing sits on top of the world

Every effect has to exist **in** the world, at a place, behind and in front of things, lit by the same light. The
screen is a window onto the land, not a stack of layers.

- **Show a natural phenomenon through its effects, never as a drawn overlay.** Wind is visible because trees lean,
  grass bends in a travelling wave, smoke and the flag stream, and animals brace. There is
  no "wind" sprite.
- Snow, rain and blown leaves fall to a spot on the ground, and trees and roofs in front of them hide them. Fog
  lies in banks among the trees, with tall trees and roofs standing up out of it.
- Insects are part of the living world (midges dancing over the ditch, moths at the yard lamp), not glowing
  tokens waiting to be collected like power-ups.
- Screen-space effects (lens flares, bokeh dots, pollen scattered across the whole frame, the bottom of the screen
  included) read as cheap and are out. The drifting pollen and seed fluff was removed for exactly this reason.

### 3. Things emerge; they don't switch

Nature doesn't flip between states, it grows into them. Wherever something changes, it should change the way it
really does: gradually, unevenly, and in the order nature would do it.

- Spring opens under last winter's snow, which melts in patches from the south-facing slopes first and lingers
  in forest shade and at the foot of the ridge. Straw greens, birches break bud first, then the other trees.
- Fields sprout, ripen and are harvested one at a time, and bales only appear once a field is cut.
- Showers build and tail off; the wind veers and freshens; fog rolls in on still mornings and burns off.
- Birdsong builds through spring into a dawn chorus and softens through summer. Cuckoos and frogs arrive; crickets
  rise and fade with the frost.

Prefer a process that produces the change over a switch that sets it. The "miracle of nature" is the emergence
itself, so it has to be visible happening.

### 4. The land is lived in

Flokk's landscape is farmland, shaped by people using the space they have as sensibly as they can.

- **No 90-degree boxes.** Fields meet the road with a narrow verge, run up to the forest with a ragged edge, and
  bend with the land. Real farmland is a patchwork of plots cut from one tract, with balks, ditches and
  hedgerows between them, at whatever angle makes sense.
- Farms turn to fit their land. Yards, houses and field blocks face the way the road and the slope suggest, not a
  shared grid.
- The farm works: the tractor goes from field to field, the farmer has a routine, the fisher goes to the lake.
- It is recognisably **Norwegian**: red and white wooden farm buildings, a parish church that may be a stave church,
  a stone church or a white wooden church, and the light of southern Norway's latitude, with long bright summer
  nights and short low winter days.
- Straight lines are people's lines (road, railway, fence, power line), and even those follow the land.

### 5. Sparse and particular

Keep the world sparse, and make each thing in it specific.

- One vehicle on the road at a time, one farmer, one fisher, one walker. A passing flock is an event because it is
  rare.
- Every voice is its own: each animal sounds like itself and no call comes out exactly the same twice. Each kind of
  train has its own horn. Variation comes from parameters and small randomness, not from more sounds played more
  often.
- Sound is ambience, not noise. When in doubt, quieter and rarer.
- Restraint beats spectacle. A single well-placed light shaft at dawn is worth more than an effect everywhere.

### 6. One world, no seams

The land loops east to west, and the loop must never show: no line in the snow, no colour jump, no strip at the
north edge in winter. A visible seam breaks the spell as surely as a floating sprite. Seams get regression tests
(`tools/seam_check.py`), across seasons, hours, zoom levels and crossfades.

Likewise, everything that moves shares one visual language. Animals, people and buildings are 3D figures, sun-lit
and turned to their heading, with feet that plant on the ground. A flat 2D sprite among them (like the old field
tractor) stands out as unfinished.

## The shape of a year

The year is the game's structure: twelve days, three per season, and the goal is to bring the flock through to
spring again. Each season should have its own mood, its own danger and its own beauty.

| | Feels like | The danger | The beauty |
|---|---|---|---|
| **Spring** | Waking up; tentative | Hawks are warier in nesting season, but food is still thin under the melting snow | Snow drawing back, birches budding, a dawn chorus building day by day |
| **Summer** | Abundance, long light | Easy to grow careless in the open | Ripening gold fields, short bright nights, crickets |
| **Autumn** | Gathering, restless | Gales push the flock about; the leaves that gave cover are falling | Harvest one field at a time, starlings and fieldfares passing through, leaves torn off in the wind |
| **Winter** | Endurance; fear | Scarce food, storms that drain the flock unless it roosts under cover, only spruce to hide in, and the owl in the long dark | Snow light, snow buntings, lamps in farm windows, the aurora |

**Winter nights are the emotional peak.** They should feel stark, cold and frightening. Nothing that softens the
ambiance anywhere else runs after dark: no mist, dew glints or light shafts. What they get instead is a thin cold
wind, a lit window you can't reach, and the quiet of a flock trying not to be heard.

## How the player learns: through the world

The player should read the game from the world, not from UI.

- A flock of wild birds bursting up off a field is often the first sign of a hawk. Crows mobbing overhead means
  something is there.
- Fog closes the view down around the flock, and it closes the hawk's view too, though an owl hunts by ear and
  hardly minds.
- Cover looks like cover: dense green foliage, dark spruce.
- A gale is felt as the flock struggling against it, not as a number.

Keep the HUD minimal. When a new mechanic needs explaining, first ask whether the world can explain it.

## Principles checklist for new work

Before a change lands, it should pass these:

1. **Is it honest?** Would it behave this way in a real Norwegian parish, at this season and hour?
2. **Is it in the world?** Is it drawn at a place, sorted with everything else, lit by the same light and hidden
   by what's in front of it? Nothing screen-space that pretends to be nature.
3. **Is a phenomenon shown through its effect?** Wind through what it moves, cold through frost and breath, danger
   through how animals react.
4. **Does it emerge?** If something changes, does it change gradually and in nature's order, rather than
   switching?
5. **Does it keep the harshness?** Never trade away danger, death or the fear of winter nights for comfort.
6. **Does it keep the softness?** Does it make the world more beautiful to be in, or at least not less?
7. **Is it sparse and specific?** Would fewer, more particular instances be better? Is the sound rare enough?
8. **Is it Norwegian and lived in?** Organic field edges, farms fitted to their land, recognisable buildings.
9. **Does it match?** Same 3D figure language, same lighting, same palette per season and hour, no seam.
10. **Did you look at it?** Check it in every season and at dawn, noon, dusk and night (`tools/survey.py`,
    `tools/seasons.py`, `tools/timelapse.py`, `tools/night.py`), and put before/after screenshots in the PR
    description.

## Tried and removed

A record of things that didn't fit, so they don't come back:

- **A calm or no-death mode.** Rejected at the start: the harshness is the point.
- **Drifting pollen and seed fluff, and the summer "lens flare" dots.** Drawn over the whole screen, so they read as
  a cheap overlay. Removed.
- **Rectangular fields on a shared grid.** Replaced by organic plots cut from tracts and fitted to the land.
- **Glowing insect swarms like pickups.** Being reworked into insects that live in the world.
- **Weather painted over the frame.** Being reworked so snow, rain, fog and wind exist in the scene.
- **Animals calling constantly; sparrows chirping at night.** Tuned down to real rhythms.
- **Flat 2D vehicles and animals among 3D figures.** Moved to the shared 3D figure language.

## Open questions

Things not yet decided, to settle with Karl as they come up:

- How much harder should a second year be, if at all?
- What role should music play, next to the ambience of the land itself?
- The game now opens on patchy melting snow, because spring starts where winter left off. Is that the right first
  impression, or should it open further into the melt?
