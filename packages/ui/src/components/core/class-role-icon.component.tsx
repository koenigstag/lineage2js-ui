import type { ClassRole } from "../../config/class-tree";

interface ClassRoleIconProps {
  role: ClassRole;
  size?: number;
  color?: string;
}

// Simple line-drawn placeholders (sword/staff/bow) -- there's no real per-role
// icon asset for this, unlike skill/item/action icons which resolve to real
// server-provided ids.
function SwordPath() {
  return (
    <>
      {/* Blade */}
      <line x1="15" y1="2" x2="5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Crossguard */}
      <line x1="3" y1="10" x2="7" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* Handle */}
      <line x1="4" y1="13" x2="1.5" y2="15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

// Same diagonal as the sword's blade, for a consistent "weapon" silhouette.
function StaffPath() {
  return (
    <>
      <line x1="15" y1="3" x2="5" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15" cy="3" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  );
}

// Shepherd's crook -- summoner mages (isSummoner) get this instead of the
// plain orb-topped staff, to set them apart from regular mages in the party window.
function ShepherdStaffPath() {
  return (
    <>
      <line x1="15" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15 5 C 15 0.5, 10 0.5, 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function BowPath() {
  return (
    <>
      {/* Bow limb + string */}
      <path d="M5 2 C 0 6, 0 14, 5 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="5" y1="2" x2="5" y2="18" stroke="currentColor" strokeWidth="0.8" />
      {/* Arrow shaft, nocked at the string and flying right, away from the bow */}
      <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Solid arrowhead, tip pointing right */}
      <polygon points="18,10 12,7 12,13" fill="currentColor" />
    </>
  );
}

function ShieldPath() {
  return (
    <path
      d="M10 1 L17 4 V10 C17 14.5 13.5 17.5 10 19 C6.5 17.5 3 14.5 3 10 V4 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}

function DaggerPath() {
  return (
    <>
      {/* Short single-edged blade, same diagonal as the sword but shorter */}
      <line x1="14" y1="4" x2="7" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Crossguard */}
      <line x1="5.5" y1="9.5" x2="8.5" y2="12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Handle */}
      <line x1="6" y1="11.5" x2="4" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function BellPath() {
  return (
    <>
      <path
        d="M10 3 V4.5 M6 15 C 6 9, 6 6, 10 6 C 14 6, 14 9, 14 15 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line x1="4.5" y1="15" x2="15.5" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="17.3" r="1.2" fill="currentColor" />
    </>
  );
}

function CrossPath() {
  return (
    <>
      <line x1="10" y1="3" x2="10" y2="17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

/**
 * Placeholder role icon for the party window (see class-tree.ts's
 * getClassRole()): tank=shield, healer=cross, buffer=bell, rogue=dagger,
 * archer=bow, summoner=shepherd's crook, mage=staff, warrior=sword.
 */
export function ClassRoleIcon({ role, size = 16, color = "#e6d9be" }: ClassRoleIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ color, flexShrink: 0 }}>
      {role === "warrior" && <SwordPath />}
      {role === "mage" && <StaffPath />}
      {role === "summoner" && <ShepherdStaffPath />}
      {role === "archer" && <BowPath />}
      {role === "tank" && <ShieldPath />}
      {role === "healer" && <CrossPath />}
      {role === "rogue" && <DaggerPath />}
      {role === "buffer" && <BellPath />}
    </svg>
  );
}

interface CrownIconProps {
  size?: number;
  color?: string;
}

/** Party leader badge (L2PartyMember.IsPartyLeader). */
export function CrownIcon({ size = 14, color = "#ffd700" }: CrownIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <path
        d="M2 12.5 L1.5 6.5 L4.5 9 L8 3 L11.5 9 L14.5 6.5 L14 12.5 Z"
        fill={color}
        stroke={color}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
