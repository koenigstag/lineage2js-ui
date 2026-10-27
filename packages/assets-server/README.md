# @lineage2js/assets-server

Static server for converted game assets, plus the offline converters that
produce them (`scripts/`). See the root `CLAUDE.md` for what is served and how
the converters are wired; this file is the **format reference** for the client
side of the game -- the Unreal Engine 2 packages the retail client renders the
world from.

## convert:maps

```bash
pnpm --filter @lineage2js/assets-server convert:maps --client="D:\Games\Lineage2\L2_HighFive_Client" --umodel="C:\ue_viewer\umodel_64.exe" --meshes
```

Writes, per map:

```
assets/highfive/maps/<x>_<y>/scene.json       terrain metadata + actor placement
assets/highfive/maps/<x>_<y>/heightmap.bin    256x256 16-bit heights, raw
assets/highfive/maps/<x>_<y>/quads.bin        per-quad visibility + edge turn
assets/highfive/maps/<x>_<y>/shadow-<i>.png   baked sun intensity, one per time slot
assets/highfive/maps/env.json                 the world's lighting curves, once
assets/highfive/static-meshes/meshes.json     per mesh: textures, LOD chain, size
assets/highfive/static-mesh-textures/...      KTX2, one per texture
```

and, with `--meshes`, the geometry those actors point at, into
`assets/highfive/static-meshes/<Package>/` via umodel. `--only=20_18,22_22`
restricts to named maps; without `--meshes` it needs no umodel at all.

Over the whole client that is **203 maps, 196791 actor placements, 15780 mesh
references resolving to 216 packages**, 14 MB of scene files, 25 MB of
heightmaps, 3.2 MB of quad bitmaps and ~64 MB of baked shadow planes (eight
per map, of which a viewer fetches one).

What a client fetches for one map, measured on 20_18:

| | |
| --- | --- |
| scene.json + heightmap | 190 kB |
| geometry, the 131 meshes it uses | 5.6 MB (2 MB compressed) |
| textures, 199 of them | **3.8 MB** as KTX2, against 38.3 MB as the TGA umodel writes |

Textures dominate because umodel *decompresses* them: the client ships DXT1 and
umodel writes RGB(A). KTX2 with Basis puts that back (10.1x on this map) and,
unlike PNG or WebP, stays block-compressed on the GPU rather than expanding to
RGBA in video memory.

`meshes.json` carries what a glTF cannot: which texture each material slot
wears (umodel puts no images in its exports, only material names, and the same
name occurs in several packages), the client's own LOD chain, and the mesh's
radius. LODs need no separate export -- they are ordinary meshes in the same
package, and only 35 of 603 meshes have them: the trees, where LOD1 is ~40% of
the triangles and LOD2 is a four-triangle billboard.

Positions stay in **L2 world units, exactly as the client stores them**, and
rotations in Unreal rotator units (65536 to the turn). The UI converts to
three.js space itself, the same way it does for creature positions off the
wire; converting here would bake one axis convention into the asset.

Two things about running it, both learned the hard way:

- **It runs in batches of child processes.** The loader keeps every package it
  opens, and one process dies about two thirds of the way through the client.
  Freeing decoded buffers between maps makes it *worse* -- packages simply
  decode again, and 85 maps get through instead of 145. A new process per
  batch is the only thing that gives the memory back.
- **`SysTextures/` must be in the asset list.** Leaving it out costs ~500
  static meshes, and not loudly: they resolve a texture package to nothing and
  throw well after their geometry is read, which reads like a mesh format bug.

## Tooling: what reads what

Measured against `D:\Games\Lineage2\L2_HighFive_Client`, not taken from docs.

| Data | Tool | Status |
| --- | --- | --- |
| `system/*.dat` tables | `scripts/client-data/l2-dat.ts`, [L2ClientDat CLI] | works |
| textures `.utx` | `umodel -export -png` / `-dds` | works |
| static meshes `.usx` | `umodel -export -gltf` | works, glTF 2.0 |
| skeletal meshes/anims `.ukx` | `umodel` (see `convert-client-rigs.ts`) | works |
| `.unr` package structure | `umodel -pkginfo <full path>` | class histogram only |
| **actors/terrain inside `.unr`** | -- | **umodel: `Unknown class "TerrainInfo"`** |
| **heightmaps** | -- | **umodel: `Unknown UE2 texture format: TEXF_G16 (10)`** |

umodel indexes only asset packages, so `-path=<client>` never finds a map: a
`.unr` has to be passed as a full file path, and even then umodel has no
classes for `TerrainInfo`, `StaticMeshActor`, `Light`, `ZoneInfo` and friends.
It covers the *assets*; it does not give you the *scene*.

The gap is filled by [Lineage2JS] and its package-reading library
[l2js-core] (both ISC, by realratchet) -- a working UE2 -> three.js renderer in
TypeScript, verified against a disassembly of the retail client (its terrain
shader cites `ATerrainInfo::Render (0x9bdfb8)` for the `Modulate2X` pass). Both
are **vendored into this workspace** as
[`@lineage2js/unreal-l2js-core`](../unreal-l2js-core) and
[`@lineage2js/unreal-l2js-objects`](../unreal-l2js-objects), with the High Five
patches applied -- read those READMEs before touching either. Upstream targets
**C4**; the deltas are listed under "High Five vs C4" below.

## What one map contains

`MAPS/<mapX>_<mapY>.unr`, wrapper `Lineage2Ver111` (28-byte UTF-16 header, XOR
`0xAC` over the body, 20-byte trailer), underneath a plain UE2 package version
**123, licensee 37**. `Textures/*.utx` and `StaticMeshes/*.usx` are
`Lineage2Ver121` instead: the key is the first ciphertext byte XOR `0xC1`,
since the first plaintext byte is always the low byte of the package tag
`0x9E2A83C1` (umodel derives the same value by summing the filename's bytes).

Class histogram of `20_18.unr` (4902 exports), which is representative:

```
1293 AmbientSoundObject    800 StaticMeshActor    653 StaticMeshInstance
 668 SpriteEmitter         258 Emitter             14 MeshEmitter
 257 Model / 257 Polys / 219 Brush   (BSP -- interiors)
 256 TerrainSector           1 TerrainInfo
 135 Light    1 NSun    1 NMoon    1 NMovableSunLight
   9 ZoneInfo   3 L2FogInfo   1 SkyZoneInfo   1 WaterVolume
  30 BlockingVolume   8 PlayerStart   6 MusicVolume   15 Camera (editor leftovers)
```

## Terrain

One `TerrainInfo` per map, and its numbers line up exactly with this project's
existing geodata addressing:

- heightmap **256x256**, format `TEXF_G16` (16-bit greyscale, little-endian),
  stored as an ordinary texture in `Textures/T_<mapX>_<mapY>.utx` under a
  `Height` group.
- `TerrainScale = (128, 128, 76)` -> 256 quads x 128 units = **32768 units**,
  which is exactly `GEO_REGION_SIZE`. One terrain quad = 8x8 geo-cells.
- `MapX`/`MapY` = 20/18 for the map covering world origin = this project's
  `GEO_REGION_ZERO_X`/`_Y`. Lineage2JS's own world->map function reduces to
  `floor(x / 32768) + 20`, the same as `worldToRegionCoords`.
- 256 `TerrainSector`s in a 16x16 grid, 16x16 quads each.

### Native tail after the tagged properties

`TerrainInfo`'s useful data is *not* all in tagged properties. After them
(licensee >= 17, archive >= 83) comes:

```
FObjectArray sectors        compact32 count + compact32 refs   (256)
int32 sectorsX, sectorsY                                       (16, 16)
FCoords toWorld             4 x FVector = 48 bytes
FCoords toHeightMap         4 x FVector = 48 bytes
int32 heightmapX, heightmapY                                   (256, 256)
[archive >= 117] FArray<FColor> vertexColors
```

**This C4 layout was verified to hold unchanged on High Five (licensee 37)** --
the probe read 256 sectors, 16x16, and 256x256 back out of `20_18.unr`.

`toWorld` for `20_18` is `origin (0, 0, 32225.86)`, axes `(128,0,0) (0,128,0)
(0,0,0.296875)`; `0.296875` is `TerrainScale.Z / 256`. Unreal's
`TransformPointBy` **subtracts the origin first**, so a heightmap sample
becomes:

```
worldX = hx * 128
worldY = hy * 128
worldZ = (h - toWorld.origin.z) * toWorld.zAxis.z
```

Sanity check: `h = 32768` gives `Z = 160.95`, and `TerrainInfo.Location.z` is
`160.65`. `toHeightMap` is the exact inverse (`1/128`, `1/0.296875`).

That relation is exact rather than approximate, and holds across the client:

```
toWorld.origin.z = 32767 - TerrainInfo.Location.z / 0.296875
```

checked on maps whose actor sits at `+160.65` (most of them), `-160.65`
(twelve) and `+353.65` (two). The FCoords already carries the terrain actor's
height, so nothing here adds it back.

That also settles something that looks like a bug and is not. Twelve maps --
16_10, 16_13, 16_26, 17_13, 17_18, 18_13, 18_26, 19_12, 19_17, 20_12, 21_12,
22_12 -- have their actor at `-160.65` and so sit **321 units below** their
neighbours, although their raw heightmaps agree with those neighbours to the
unit. The step is authored in the client, not introduced by this converter, and
it is almost never visible: of the 33 borders where the raw heights agree and
the world Z does not, 31 have flat filler on both sides, and the two carrying
real relief step by 57 and 58 units. 62 of the 203 maps are a single height end
to end -- open sea and out-of-bounds -- which is why so many borders are filler
meeting filler.

### Lighting

**The light is not in the level.** A map carries a `LevelInfo` ambient and an
`NMovableSunLight`, which look like the obvious source and are not: the
runtime never reads either for colour. It reads `system/env.int` and the four
`system/timeenv<n>.int` files that env.int names -- one set for the whole
client, a curve over the day, and a **separate curve per surface class**.

Finding that out corrected a wrong answer, and the measurement that should
have given it away earlier is this one:

```
          LevelInfo ambient   ZoneInfo ambients
20_18           25.41         9 zones,  0 .. 50.82
20_19            0.85         1 zone,   0
22_22            0.00        17 zones, 16.94 .. 67.76

across all 203 maps: 192 have a LevelInfo ambient below 1
```

A world whose ambient is zero on 95% of its maps is not a world with a
daylight model in its levels. (These values are still baked, as `lighting` in
`scene.json`, together with `NMovableSunLight`'s colour and rotator. Only the
rotator is used -- for the direction the meshes are lit from -- and the rest
is kept because the zone ambients are real level data that the BSP work will
want.)

#### The curves

`convert:maps` writes `maps/env.json` once per run, beside the maps rather
than inside any of them. Decoding is the same `Lineage2Ver111` wrapper as the
`.unr` files -- 28-byte header, XOR `0xAC` -- with EUC-KR text inside.

```
[EnvSetup]           StartTime=22  TimeRatio=6  StaticLightingAdjust=4
[TerrainShadowMap]   Num=8  AutoTimeGeneration=true
[FOG]                StartRange1..5 / EndRange1..5   (x2048 -- see Sky and fog)
TimeEnvFileName0..3  TimeEnv0.INT .. TimeEnv3.INT    (normal/dusk/dawn/cursed)
```

`--env` rewrites `env.json` alone, without touching a map: these are two files
in the client's `system/`, so adding a field to them should not cost a re-bake
of all 203.

Each `TimeEnv` file holds 25 points per curve, one an hour with both ends of
the day present, for `TerrainAmbient`, `StaticMeshAmbient`, `ActorAmbient`,
`BSPAmbient` and the four matching `HSV*Light` curves. At noon, cycle 0:

```
TerrainAmbient      (120, 120, 120)
HSVTerrainLight     Hue=1 Sat=255 Bri=200   ->  (216, 216, 216) x 200/255
StaticMeshAmbient   (120, 120, 120)
HSVStaticMeshLight  Hue=1 Sat=255 Bri=190   ->  (216, 216, 216) x 190/255
```

The HSB conversion is the client's own and is not a standard one: saturation
lerps the hue *towards white*, so `Sat=255` is grey, and brightness is over
255 and exceeds it (450 at dawn). The converter runs the vendored package's
`hsvToRgb` at full value and emits the colour and the brightness separately,
because the client interpolates them apart and multiplies last.

The files are hand-maintained and show it: `COLOR1=(T=0,R=110,G=84,B=77`
without its closing paren, `Light11=( T=10  Hue=1,` without its comma. The
parser pulls `NAME=number` pairs out of a value rather than matching a shape,
which is why those rows load.

#### The formula

```
terrain = ambient.terrain/2 + light.terrain * intensity/255 * 0.5
mesh    = ambient.staticMesh/2 + light.staticMesh * 32/255
```

and both are doubled where they meet the texture (`D3DTOP_MODULATE2X`). The
halving is a byte shift in the client, and the `0.5` and the `32` are
constants read out of its code -- see the vendored package's
`rendering/l2-env.ts` and `objects/terrain.ts`, which carry the addresses.

At noon that puts open ground at `(60 + 169*213/255*0.5)/255 * 2 = 1.03` --
the texture at its own brightness, which is a good sign that the chain is
right -- shadowed ground at `0.47`, and a static mesh at `0.63`.

**The terrain has no diffuse term.** No dot product against a sun direction
anywhere in the client's ground path. Putting one there counts the geometry
twice, because the `intensity` above already holds it; that is what made a
tree trunk measure `(1,1,1)` while the grass beside it was fine.

#### Per-sector shadow maps

That `intensity` is baked per terrain vertex and stored on the sector:

```
hasShadows   int32
shadowCount  int32          8, from [TerrainShadowMap] Num
shadowMaps   count x 289 bytes     17x17, one per vertex of the 16x16 quads
times        i*24/count + 12/count  ->  1.5, 4.5, 7.5 ... 22.5
```

Every one of the 256 sectors on every map checked carries all eight. The
values are a smooth field over the whole byte range, not a mask: 213 is
typical open ground and 0 is full occlusion, with everything between.

`convert:maps` assembles them into one 256x256 greyscale PNG per plane,
`shadow-<i>.png`, indexed exactly like the heightmap -- sample
`(x + offsetX, y + offsetY)`, clamped to the last row and column, which is how
the sector reader places its vertices. The clamp makes adjacent sectors write
their shared edge twice; they agree on all but 116 of 8448 shared samples on
20_19, so the last writer wins rather than duplicating vertices over a
difference nobody can see.

Two oddities in the client's own data, left as they are:

- **Planes repeat.** Plane 0 (1.5h) is byte-identical to plane 3 (10.5h), and
  plane 1 (4.5h) to plane 6 (19.5h), on every map checked. Six distinct bakes
  wearing eight labels -- the editor evidently reused the morning occlusion
  for the small hours, where the "sun" is a blue moonlight term anyway.
- **PNG, not raw.** 64kB of smooth intensity deflates to about 40kB, the
  browser decodes it into a texture without a width and height travelling
  beside it, and -- the practical reason -- a PNG can be opened and looked at,
  which is how you tell a shadow map from a mistake.

### A map can carry more than one TerrainInfo

`12_24` has two: its own ground, and a second at half the quad size whose
corner sits 3296 units inside the map. Both report the same `mapX`/`mapY`, so
only the transform separates them -- **the map's own terrain is the one whose
heightmap sample `(0, 0)` lands on the map's minimum corner**, the same
arithmetic `scene.json`'s `worldOrigin` uses.

Taking the first export, which is what the converter did until this was
measured, put the wrong terrain in that map's scene file: its ground came out
11353 units below its neighbours, at the wrong scale, and off the geodata it is
meant to agree with. `convert:maps` now picks by that corner, and says so in
the map's line when a map has more than one. 12_24 is the only one in the
client that does, and after the fix no map's terrain starts anywhere but on its
own corner.

### Terrain is ~32 units below the geodata

Sampling `20_18`'s heightmap every 4th vertex and comparing each world Z
against the nearest layer of this project's own baked geodata tiles:

- orientation is unflipped (`x = hx*128, y = hy*128`) -- the three flipped
  variants come out 30-50x worse, so this is not a coincidence;
- where the two describe the same surface, the terrain sits **31-33 units
  below** the geodata, tightly (p10 -37.6, p90 -26.4).

So the geodata's walkable plane is a constant offset above the visual ground,
not a resampling of it. Anything that places a character on real terrain has to
account for that or bodies will sink into the mesh.

The remaining spread is expected: geodata only describes walkable surfaces, so
under a building, a cliff or the sea there is no layer that corresponds to the
visible ground at all.

### Layers

Up to 8 layers (`NumIntMap` says how many are used), each a `TerrainLayer`
struct in the `Layers` static array:

```
layer 0  T_oren.Obase_1   alpha T_texture.Texture.layer0   (base, bUseAlpha False)
layer 1  T_oren.OG_52     alpha T_20_18.Height.20_18_S     U 1    V 1
layer 2  T_oren.OG_34     alpha T_20_18.Height.20_18_G1
layer 3  T_oren.OG_48     alpha T_20_18.Height.20_18_G2
layer 4  T_oren.OG_36     alpha T_20_18.Height.20_18_G
layer 5  T_oren.OC_05     alpha T_20_18.Height.20_18_ST
layer 6  T_oren.OC_03     alpha T_20_18.Height.20_18_CA    U 3    V 3
layer 7  T_oren.OST_11    alpha T_20_18.Height.20_18_ST1   U 1.5  V 1.5
```

The alpha maps live in the same `.utx` as the heightmap, are 1024x1024, and
**umodel exports them fine** -- only the G16 heightmap defeats it. Layers
composite front-to-back with plain `over` blending, then the whole result is
multiplied by 2 (`D3DTOP_MODULATE2X`, which the retail renderer passes when it
enables lighting).

Each sector stores which layer *combinations* actually occur in it, so a
sector samples only the layers it needs rather than all eight.

### Per-sector data

- `quadVisibilityBitmap` -- per-quad hole mask (cave mouths, etc.).
- `edgeTurnBitmap` -- which diagonal a quad is split along (`123/134` vs
  `124/423`); getting it wrong shows up as wrong shading on slopes.
- `shadowMaps[]` -- the baked sun intensity, eight per sector. See
  [Per-sector shadow maps](#per-sector-shadow-maps) under Lighting, which is
  where the whole chain they belong to is written down.
- `lightInfos[]` -- which of the map's 135 `Light` actors reach this sector,
  each with its own per-vertex visibility bitmap. Not extracted: a point light
  is the `sum(lightColor * intensity)` term of the client's formula, and
  nothing here draws one yet.

The two bitmaps go out as `quads.bin`: visibility first, then edge turn, one
bit per quad at `x + y * heightmapWidth`, least significant bit first -- 8192
bytes each for a 256x256 map. The `...Orig` (seamless) variants are the ones
taken, matching what the client's own sector builder reads. A separate file
rather than a field in the JSON: 16 kB of bits would be 22 kB of base64 in a
file that is otherwise 63 kB.

### Sky and fog

`scene.json` carries an `environment` block, from the map's own `L2FogInfo`
plus its `NSun`/`NMoon` billboards:

```
fogRanges  five distance bands, near to far, L2 units    [[0,8000] ... [0,24000]]
times[]    per time of day: hour, fog RGB, sky RGB, haze RGB
sun/moon   billboard radius and its Unreal rotator
```

For 20_18 that is eight time entries -- 0h sky `58,49,70`, 8h `126,158,241`,
20h `60,111,157`, 23h `82,90,135` -- so the colours a map is meant to be seen
in are stated by the map, not a matter of taste. A map has one `L2FogInfo` per
zone and the converter takes the first: choosing by the zone the camera stands
in needs the BSP the zones are defined by, which nothing here reads yet.

#### The map's fog ranges are a local override, not the map's fog

Every near in `fogRanges` is 0, on every map in the client. That is not a
reading error -- `AffectRange` on the same actor reads `(3000..4000)` through
the same `FRange` struct -- and it is not the fog the world is drawn with
either. An `L2FogInfo` is a *zone* effect, in force only while the camera
stands inside that affect range, and there it replaces the global fog
outright:

```js
// rendering/render-manager.ts, the vendored renderer
if (this.activeFogId) {
    targetFogStart = accStart / totalFogWeight;   // the zone's own range, near = 0
    ...
} else {
    // No active zone fog - already has default values from Env.int
}
```

So a swamp's fog really does begin at your feet, and everywhere else the fog
comes from `env.int`'s `[FOG]`:

```
StartRange1..5   1.0  1.5  2.0  2.5   4.0      x2048 ->  2048  3072  4096  5120   8192
EndRange1..5     4.0  5.0  6.0  7.0  10.0      x2048 ->  8192 10240 12288 14336  20480
```

The factor is **2048**, not the 2000 the file's own comment claims; it comes
from a trace of the real client (`2.5 * 2048 = 5120`), recorded in the
vendored renderer beside the code above. Reading the map's bands as the world
fog is what made the fog start at the camera everywhere, which washed out
every near surface -- a slope 56 units away measured `(102,84,64)` against its
own `(89,69,40)`.

The five bands exist because the client picks one by the player's view-distance
setting. A renderer with a fixed draw distance wants the widest band that still
closes before its ground runs out; anything wider leaves the terrain's edge
visible, which is the thing fog is there to prevent. At this project's 260
units that is band 3, 4096..12288, which closes at 234 with the ground ending
at 260.

## Static meshes

`20_18.unr` has 797 `StaticMeshActor`s carrying a mesh -- but only **131
distinct meshes from 10 packages**:

```
216 field_deco_S   147 Oren_DEV_S   147 Oren_tree_S   131 sylen_temple_s
111 interior_B_delf_s   30 Field_Deco_Artifact_S   8 Door_Set_S   ...
```

Heavy instancing, so the per-map asset budget is small and the renderer wants
`InstancedMesh` per distinct mesh. `umodel -export -gltf` handles the meshes
themselves, which is the same path `convert-client-rigs.ts` already uses.

### What makes a slot transparent is the Opacity, not the mode

A material slot is either a bare `StaticMeshMaterial -> Texture`, or that
wrapped in a `Shader`. One tree shows both:

```
Oren_Darkelf_tree02_A
  slot 0  StaticMeshMaterial -> Texture {format=3}                       bark
  slot 1  StaticMeshMaterial -> Texture {format=3}                       bark
  slot 2  StaticMeshMaterial -> Shader {outputBlending=0 AlphaRef=1
                                        opacity=yes} -> Texture {format=7}   leaves
```

Format 3 is DXT1, format 7 is DXT3 -- the leaves are the ones carrying a real
alpha channel. But the mode alone does not say to blend them: `outputBlending`
is `0`, `OB_Normal`, the same value a solid wall has. The engine's own rule,
quoted beside the blend switch in `unreal-l2js-objects`:

```
if (OutputBlending == OB_Normal && !Opacity) glDisable(GL_BLEND);
else                                         glEnable(GL_BLEND);
```

so it is the **presence of an Opacity** that decides. Measured over the whole
client, that distinction is the entire feature: of 6248 slots carrying a
Shader, 3123 are `OB_Normal` with no Opacity and must stay opaque, while 1415
are `OB_Normal` *with* one and are the foliage. Treating the mode as the
answer would blend half the world's masonry and still leave every leaf a card.

`meshes.json` therefore carries a `blends` array beside `textures`, per slot:
`{ mode, alphaRef, opacity }`, and only for meshes where some slot is not
plain opaque -- 3033 of 8269. `OB_Masked` (1658 slots) additionally discards
fully transparent texels, `glAlphaFunc(GL_GREATER, 0)`.

Regenerate that table alone with `--mesh-table`: it is metadata read out of
the packages, so it needs neither umodel nor an encoder and takes seconds
rather than the hour a full `--meshes` pass costs.

### A LOD is a mesh, and needs its own row

`lods` names the client's simplified versions, and the renderer swaps to one
by name -- so each is looked up in this table like any other mesh. They were
not in it: 598 of 716 had no row, so a distant tree arrived with no texture
and no blend and drew as a flat card in umodel's placeholder colour. The chain
is only known once the base mesh has been read, so the table is filled in a
second pass over whatever LODs the first pass named.

### Textures tile; three's do not

`UClampMode`/`VClampMode` on the texture, `TC_Wrap = 0` and `TC_Clamp = 1`.
Over the whole client **13 slots of 55183 actually clamp** -- everything else
tiles, which is what bark, walls and floors need. three's `Texture` defaults
the other way, and a clamped bark texture smears its last column down the
length of the trunk. `meshes.json` carries a `clamps` array for the thirteen
exceptions and the renderer tiles by default.

### Leaf alpha is not a stencil

Measured on `Oren_Darkelf_Leaf00_` (512x512, DXT3): **71.8% of texels are
alpha 0, 15.2% are full, and 13% lie in between** -- an authored soft edge
about a texel wide around every leaf, which is why the client blends these
rather than masking them. Cutting at the midpoint would throw that edge away;
cutting just above zero discards the 72% that is nothing and leaves the edge
to blend.

A blended surface must not write depth, though. With depth writes on, the
first leaf card drawn blends its edge against whatever is already in the
buffer -- the sky -- and then occludes the card behind it, so every branch
keeps a sky-coloured halo no matter what is really behind it. Opaque geometry
is drawn before the transparent pass, so trunks, ground and hillsides still
show through the fringe correctly.

### A static mesh is a texture times a light

There is no surface model. The client's static mesh shader ends

```glsl
vLitColor = clamp(lighting + staticMeshSunAmbient * sunAffected, 0.0, 1.0);
...
reflectedLight.indirectDiffuse += vLitColor * 2.0;
```

and that is all of it -- no normal, no roughness, no diffuse term. Which means
a renderer should draw these **unlit** and multiply, not hand them to a PBR
material and hope the lights come out right.

`sunAffected` is the actor's `bSunAffect`, and it is off far more often than
you would guess: **312 of 800 actors on 20_18, 419 of 2030 on 22_22, 0 of
1112 on an open field map**. Switching the sun off is only half the branch,
though -- the client then lights the actor from its zone's `AmbientVector`:

```js
// UStaticMeshActor, the vendored reader
if (!this.isSunAffected) {
    for (const leaf of leaves) { ...max of each leaf zone's ambientVector... }
    else [ambX, ambY, ambZ] = this.getZone().ambientVector.getElements();
}
```

**That zone needs no BSP walk.** An actor's `Region` names its zone outright,
because the editor already resolved it, and `actor.getZone().ambientVector`
answers for every one of them -- 312 of 312 on 20_18, 419 of 419 on 22_22,
nothing thrown. So `convert:maps` bakes `sun: 0` and `amb` per actor, and the
renderer needs no zone machinery at all:

```
20_18   (100.7)x208   (0)x101   (70.7)x1
22_22   (116.5)x174   (57.4)x82   (100.7)x71   (90.8)x39 ...
```

A zero there is a real answer, not a missing one: those actors are lit by the
torches beside them. For scale, the outdoor flat term at noon is 80.2, so an
interior is authored slightly brighter than open ground -- it has to be,
with no sun in it.

**So 1178 actors in the world render black**, 0.6% of all 196791 and 2.6% of
the indoor ones. That is the client's own arithmetic followed to its end, and
it is left alone rather than floored: what is missing is not the ambient, it
is the `Light` actors standing next to them, and a fabricated floor would
hide that instead of showing it.

#### What is still not read: the per-instance colour stream

`UStaticMeshInstance.colorStream` holds one colour per mesh vertex, which is
the editor's bake of the `Light` actors reaching that placement. Measured:

```
            actors   non-zero stream   uniform   bytes
20_18          800      121 (15.1%)          0    73 kB
22_22         2030      144 ( 7.1%)          0   194 kB
20_19         1112        0 ( 0.0%)          0     0
```

The length always equals the mesh's vertex count exactly. Two things follow.
It is worth having -- it is the only thing lighting a torchlit interior, and
the 101 actors on 20_18 with a zero zone ambient have nothing else. And it
cannot ride on an `InstancedMesh`, because not one instance is uniform: the
placements that have it would have to be drawn as their own meshes with their
own colour attribute. That is 7-15% of a town's actors, and none of a field's.

## High Five vs C4

Deltas found so far against Lineage2JS's readers, which were written for C4:

- **`UTexture` carries an extra block on High Five.** Between the properties
  and the mipmaps sit zero padding, the texture's name, more padding, an
  **HLSL fragment** (`float4 texcolor0=tex2D(s[0], ...)`) the client ships per
  texture, and a trailer. Neither its size nor its presence can be read off a
  flag: padding runs from 32 bytes to over a thousand across this client's
  packages, and `T_15_23`'s heightmap has the block without the `0x100` bit
  Lineage2JS keys on. The reader therefore skips it by locating the mipmap
  array through its own invariant instead. Verified across **45301 of 45301
  textures in 548 packages**, licensee 33 through 39.
- **Two structs C4 does not declare**: `INT64` and `ParamMap`, which
  `loadNativeClasses()` walks over in `Core.u`. Nothing reads them; they only
  have to be constructible. That is the complete set for this client.
- `TerrainInfo`'s native tail is unchanged, despite the licensee bump (37 vs
  C4's 23) -- verified by reading 256 sectors, 16x16, and 256x256 back out of
  `20_18.unr` through the vendored reader.

[L2ClientDat CLI]: https://github.com/MobiusDevelopment/l2clientdat
[Lineage2JS]: https://github.com/realratchet/Lineage2JS
[l2js-core]: https://github.com/realratchet/l2js-core
