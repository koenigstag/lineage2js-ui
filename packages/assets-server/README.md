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
assets/highfive/static-meshes/meshes.json     per mesh: textures, LOD chain, size
assets/highfive/static-mesh-textures/...      KTX2, one per texture
```

and, with `--meshes`, the geometry those actors point at, into
`assets/highfive/static-meshes/<Package>/` via umodel. `--only=20_18,22_22`
restricts to named maps; without `--meshes` it needs no umodel at all.

Over the whole client that is **203 maps, 196791 actor placements, 15780 mesh
references resolving to 216 packages**, 14 MB of scene files, 25 MB of
heightmaps and 3.2 MB of quad bitmaps.

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
- `shadowMaps[]` -- **N baked shadow maps per sector, one per time of day**,
  with `shadowMapTimes[i] = i * 24/N + 12/N`. Terrain lighting in the retail
  client is
  `color = ambient + sunColor * shadow/255 + sum(lightColor * intensity)`,
  with the ambient added unconditionally rather than modulated by the shadow.

The two bitmaps go out as `quads.bin`: visibility first, then edge turn, one
bit per quad at `x + y * heightmapWidth`, least significant bit first -- 8192
bytes each for a 256x256 map. The `...Orig` (seamless) variants are the ones
taken, matching what the client's own sector builder reads. A separate file
rather than a field in the JSON: 16 kB of bits would be 22 kB of base64 in a
file that is otherwise 63 kB. The shadow maps are not extracted yet.

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

The five bands exist because the client picks one by the player's view-distance
setting. A renderer with a fixed draw distance wants the widest band that still
closes before its ground runs out; anything wider leaves the terrain's edge
visible, which is the thing fog is there to prevent.

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
