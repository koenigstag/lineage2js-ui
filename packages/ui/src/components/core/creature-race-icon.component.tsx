import type { NpcRace } from "../../config/npc-race-mapping";

interface CreatureRaceIconProps {
  race: NpcRace;
  size?: number;
  color?: string;
}

// Round head + shoulders silhouette.
function HumanPath() {
  return (
    <>
      <circle cx="10" cy="6" r="3.2" fill="currentColor" />
      <path d="M4 17 C4 12.5 6.7 10.5 10 10.5 C13.3 10.5 16 12.5 16 17 Z" fill="currentColor" />
    </>
  );
}

// Squarish head with two small pointed ears on top ("goblin-like"), hunched
// asymmetric body -- deliberately not round-headed like Human.
function HumanoidPath() {
  return (
    <>
      <path d="M7 3 L6 6.2 L8.3 6.2 Z" fill="currentColor" />
      <path d="M13 3 L14 6.2 L11.7 6.2 Z" fill="currentColor" />
      <rect x="6.3" y="5" width="7.4" height="6" rx="1.3" fill="currentColor" />
      <path d="M4 17.5 C4 13 6.5 11.3 10 11.3 C13.5 11.3 16 13 16 17.5 Z" fill="currentColor" />
    </>
  );
}

// A single elongated pointed ear -- no head/body, just the ear glyph.
function ElfPath() {
  return <path d="M11 1 C16 3 17 9 13 14 C11 16.5 7 15.5 6.5 12.5 C9.5 12 11.5 8 11 1 Z" fill="currentColor" />;
}

// Same ear glyph, shifted aside, plus a small separate 4-point sparkle
// (night motif) -- clearly two marks, not a subtle variation on Elf's one.
function DarkElfPath() {
  return (
    <>
      <path d="M13.5 1 C18 3 19 8.5 15.5 13.5 C13.5 16 10 15 9.5 12.2 C12.2 11.7 14 8 13.5 1 Z" fill="currentColor" />
      <polygon points="3,6.5 3.9,10 3,13.5 2.1,10" fill="currentColor" />
      <polygon points="0.3,10 3,9.2 5.7,10 3,10.8" fill="currentColor" />
    </>
  );
}

// Mouth curve with two downward tusks at the corners.
function OrcPath() {
  return (
    <>
      <path d="M4 9 Q10 13.5 16 9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4.5 9.3 C3.3 12 3.6 15 5 17.3 C5.9 14.7 5.9 11.5 6.6 9.7 Z" fill="currentColor" />
      <path d="M15.5 9.3 C16.7 12 16.4 15 15 17.3 C14.1 14.7 14.1 11.5 13.4 9.7 Z" fill="currentColor" />
    </>
  );
}

// Pickaxe -- diagonal handle, two clearly separated angular blades at the top.
function DwarfPath() {
  return (
    <>
      <line x1="7" y1="17.5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13 5 L18.5 2 L15.5 8 Z" fill="currentColor" />
      <path d="M13 5 L7.5 2 L10.5 8 Z" fill="currentColor" />
    </>
  );
}

// Single large angular wing.
function KamaelPath() {
  return <path d="M4 17 C4 12 5 7 8 3 C9.5 6 9.5 10 8.5 13 C11 11 13.5 8.5 16 4 C15.5 9 13.5 14 4 17 Z" fill="currentColor" />;
}

// Small, soft, rounded wing pair -- dainty, unlike Kamael's single angular wing.
function FairyPath() {
  return (
    <>
      <path d="M10 10 C7 6 3 6 2.5 9 C2.2 12 6.5 12.5 10 10 Z" fill="currentColor" />
      <path d="M10 10 C13 6 17 6 17.5 9 C17.8 12 13.5 12.5 10 10 Z" fill="currentColor" />
      <circle cx="10" cy="11" r="1.3" fill="currentColor" />
    </>
  );
}

// Skull -- round cranium, two eye sockets, jaw line.
function UndeadPath() {
  return (
    <>
      <path d="M10 3 C6 3 4.5 6 4.5 9 C4.5 11.5 6 12.5 6 14 L14 14 C14 12.5 15.5 11.5 15.5 9 C15.5 6 14 3 10 3 Z" fill="currentColor" />
      <circle cx="7.3" cy="9" r="1.5" fill="#101010" />
      <circle cx="12.7" cy="9" r="1.5" fill="#101010" />
      <rect x="7" y="15" width="6" height="2.2" rx="0.5" fill="currentColor" />
    </>
  );
}

// Two horns pointing outward/up, plus a pointed chin -- a devil-face
// silhouette (no enclosing curve at the base, so it doesn't read as a heart).
function DemonicPath() {
  return (
    <>
      <path d="M4 11 C4 6 6.5 2 8 5 C9 7.5 8 9.5 6.5 11 Z" fill="currentColor" />
      <path d="M16 11 C16 6 13.5 2 12 5 C11 7.5 12 9.5 13.5 11 Z" fill="currentColor" />
      <path d="M7 11 L13 11 L10 16.5 Z" fill="currentColor" />
    </>
  );
}

// Halo -- a ring with radiating rays.
function DivinePath() {
  return (
    <>
      <ellipse cx="10" cy="6.5" rx="5.5" ry="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <line x1="10" y1="9.5" x2="10" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

// Teardrop/flame shape.
function ElementalPath() {
  return <path d="M10 2 C14 8 15.5 11 15.5 13.5 C15.5 16.5 13 18 10 18 C7 18 4.5 16.5 4.5 13.5 C4.5 11 6 8 10 2 Z" fill="currentColor" />;
}

// Reptilian head profile -- triangular snout + single back horn.
function DragonPath() {
  return (
    <>
      <path d="M3 11 L11 8 L17 10 L13 12.5 L11 15 L8 12.5 Z" fill="currentColor" />
      <path d="M11 8 L12 3 L14 8.5 Z" fill="currentColor" />
      <circle cx="12" cy="10" r="0.9" fill="#101010" />
    </>
  );
}

// One big, heavy footprint -- larger sole and fewer/chunkier toes than
// Animal's dainty paw print, so the two don't read the same at a glance.
function GiantPath() {
  return (
    <>
      <ellipse cx="10" cy="12.5" rx="5.2" ry="6" fill="currentColor" />
      <circle cx="6" cy="4.3" r="1.9" fill="currentColor" />
      <circle cx="10" cy="2.8" r="2" fill="currentColor" />
      <circle cx="14" cy="4.3" r="1.9" fill="currentColor" />
    </>
  );
}

// Gear/cog -- mechanical.
function ConstructPath() {
  return (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect key={deg} x="9.1" y="1.5" width="1.8" height="4" rx="0.5" fill="currentColor" transform={`rotate(${deg} 10 10)`} />
      ))}
      <circle cx="10" cy="10" r="4.6" fill="currentColor" />
      <circle cx="10" cy="10" r="2.1" fill="#101010" />
    </>
  );
}

// Three claw-slash strokes, same motif as the party window's "mob" kind icon.
function BeastPath() {
  return (
    <>
      <line x1="4" y1="4" x2="9" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="3" x2="12" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="4" x2="16" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

// Paw print -- pad + four toes.
function AnimalPath() {
  return (
    <>
      <ellipse cx="10" cy="13" rx="4.2" ry="3.4" fill="currentColor" />
      <circle cx="4.5" cy="6.5" r="1.7" fill="currentColor" />
      <circle cx="9" cy="4.2" r="1.7" fill="currentColor" />
      <circle cx="14" cy="4.6" r="1.7" fill="currentColor" />
      <circle cx="16.5" cy="8.5" r="1.6" fill="currentColor" />
    </>
  );
}

// Three-segment body (head/thorax/abdomen) + antennae + two leg-pairs --
// the legs are what read as "insect" rather than a furry animal silhouette.
function BugPath() {
  return (
    <>
      <line x1="7.5" y1="5" x2="6" y2="2.3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="12.5" y1="5" x2="14" y2="2.3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="10" cy="6" r="1.6" fill="currentColor" />
      <ellipse cx="10" cy="10.3" rx="2.8" ry="2.4" fill="currentColor" />
      <ellipse cx="10" cy="15" rx="3.6" ry="3" fill="currentColor" />
      <line x1="7.6" y1="9.8" x2="3.5" y2="8.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="12.4" y1="9.8" x2="16.5" y2="8.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="7.6" y1="14.5" x2="3.5" y2="16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="12.4" y1="14.5" x2="16.5" y2="16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  );
}

// Leaf -- teardrop with a center vein.
function PlantPath() {
  return (
    <>
      <path d="M4 16 C4 8 10 3 16 3 C16 10 11 16 4 16 Z" fill="currentColor" />
      <line x1="5" y1="15" x2="14" y2="5" stroke="#101010" strokeWidth="1" strokeLinecap="round" />
    </>
  );
}

// Shield with a small banner spike on top -- guard-post emblem.
function CastleGuardPath() {
  return (
    <>
      <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M10 4 L16.5 6.5 V11 C16.5 15 13 17.5 10 19 C7 17.5 3.5 15 3.5 11 V6.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </>
  );
}

// Triangular ballista/catapult silhouette.
function SiegeWeaponPath() {
  return (
    <>
      <path d="M3 17 L17 17 L10 8 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="10" y1="8" x2="15" y2="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

// Crossed swords.
function MercenaryPath() {
  return (
    <>
      <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="17" y1="3" x2="3" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="3" y1="3" x2="6" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="3" y1="3" x2="3" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="17" y1="3" x2="14" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="17" y1="3" x2="17" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

// Catch-all (static objects, decorative NPCs, ...) -- plain diamond marker.
function EtcPath() {
  return <rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor" transform="rotate(45 10 10)" />;
}

/** Race icon for non-player creature targets, see config/npc-race-mapping.ts. */
export function CreatureRaceIcon({ race, size = 16, color = "#e6d9be" }: CreatureRaceIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ color, flexShrink: 0 }}>
      {race === "HUMAN" && <HumanPath />}
      {race === "HUMANOID" && <HumanoidPath />}
      {race === "ELF" && <ElfPath />}
      {race === "DARK_ELF" && <DarkElfPath />}
      {race === "ORC" && <OrcPath />}
      {race === "DWARF" && <DwarfPath />}
      {race === "KAMAEL" && <KamaelPath />}
      {race === "FAIRY" && <FairyPath />}
      {race === "UNDEAD" && <UndeadPath />}
      {race === "DEMONIC" && <DemonicPath />}
      {race === "DIVINE" && <DivinePath />}
      {race === "ELEMENTAL" && <ElementalPath />}
      {race === "DRAGON" && <DragonPath />}
      {race === "GIANT" && <GiantPath />}
      {race === "CONSTRUCT" && <ConstructPath />}
      {race === "BEAST" && <BeastPath />}
      {race === "ANIMAL" && <AnimalPath />}
      {race === "BUG" && <BugPath />}
      {race === "PLANT" && <PlantPath />}
      {race === "CASTLE_GUARD" && <CastleGuardPath />}
      {race === "SIEGE_WEAPON" && <SiegeWeaponPath />}
      {race === "MERCENARY" && <MercenaryPath />}
      {race === "ETC" && <EtcPath />}
    </svg>
  );
}
