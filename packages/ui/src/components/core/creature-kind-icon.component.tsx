export type CreatureKind = "mob" | "npc" | "summon";

interface CreatureKindIconProps {
  kind: CreatureKind;
  size?: number;
  color?: string;
}

// Attackable monster -- three claw-slash strokes.
function MobPath() {
  return (
    <>
      <line x1="4" y1="4" x2="9" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="3" x2="12" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="4" x2="16" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

// Non-attackable NPC -- the classic quest-giver "!" mark.
function NpcPath() {
  return (
    <>
      <line x1="10" y1="3" x2="10" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="10" cy="16.5" r="1.4" fill="currentColor" />
    </>
  );
}

// Summon/pet -- a paw print (pad + four toes).
function SummonPath() {
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

/** Type icon for non-player targets -- see GameStore.TargetSnapshot.creatureKind. */
export function CreatureKindIcon({ kind, size = 16, color = "#e6d9be" }: CreatureKindIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ color, flexShrink: 0 }}>
      {kind === "mob" && <MobPath />}
      {kind === "npc" && <NpcPath />}
      {kind === "summon" && <SummonPath />}
    </svg>
  );
}
