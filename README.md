# Pixel Tile Builder

A tilemap editor + playable top-down prototype, in the style of your reference screenshot —
built with Next.js and **procedurally drawn pixel-art tiles** (no bitmap assets, so it's tiny
and easy to restyle in code).

## Run it
```
npm install
npm run dev
```
Open http://localhost:3000

## What's in here
- **Edit mode**: click/drag to paint tiles. Ground layer (grass, flowered grass, dirt path,
  water) and an Object layer on top (stone wall, tree, bush, cabin wall/floor, fence). An
  Erase tool clears whatever's on the object layer at a cell.
- **Play mode**: switch to Play and walk around with WASD/arrow keys. Trees, walls, fences,
  bushes and water all block movement; everything else is walkable. The character and tall
  objects (trees) are depth-sorted by row so the canopy can overlap you correctly.
- **Persistence**: the map autosaves to localStorage as you paint. You can also Export to a
  `map.json` file and Import it back later (or share it / commit it to git).

## Where to go next
- `lib/tiles.js` is the whole "asset pipeline" — every tile and the character are drawn with
  plain `fillRect` calls on a 16x16 pixel grid. Add a new entry to the `TILES` array to add a
  new tile type (give it an `id`, `layer` ('ground' or 'object'), `collidable`, and a `draw`
  function).
- If you later get real sprite sheets (commissioned or from an asset pack), swap the relevant
  `draw` functions for `ctx.drawImage(...)` calls — the editor/game logic around them doesn't
  need to change.
- Easy next features: multiple character outfits (the `hue` param on `drawCharacter` is ready
  for that), a second editable map "room" with doors/transitions, NPCs that idle-animate using
  the same `drawCharacter` function, camera scrolling for maps bigger than the viewport.
