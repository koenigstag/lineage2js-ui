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

function StaffPath() {
  return (
    <>
      <line x1="8" y1="4" x2="8" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="3" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  );
}

function BowPath() {
  return (
    <>
      <path d="M6 2 C 1 6, 1 14, 6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="6" y1="2" x2="6" y2="18" stroke="currentColor" strokeWidth="0.8" />
      <line x1="4" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M17 10 L14 8.5 M17 10 L14 11.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

/** Placeholder role icon for the party window -- warrior=sword, mage=staff, archer=bow (see class-tree.ts's getClassRole()). */
export function ClassRoleIcon({ role, size = 16, color = "#e6d9be" }: ClassRoleIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ color, flexShrink: 0 }}>
      {role === "warrior" && <SwordPath />}
      {role === "mage" && <StaffPath />}
      {role === "archer" && <BowPath />}
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
