// Shared CP/HP/MP fill colors -- char-info and party-char-info windows both use these.
export const CP_COLOR = "linear-gradient(180deg, #ffd76a 0%, #ff8c00 100%)";
export const HP_COLOR = "linear-gradient(180deg, #ff7a6e 0%, #c22b1f 100%)";
export const MP_COLOR = "linear-gradient(180deg, #6ea9ff 0%, #1f4fc2 100%)";
export const VITALITY_COLOR = "linear-gradient(180deg, #9acd32 0%, #4c6b1a 100%)";
// Weight (WG) and XP bars -- only used by the "character" window's full stats
// panel so far (see character.window.tsx), same 180deg light-to-dark style as
// the bars above for a consistent look.
export const WG_COLOR = "linear-gradient(180deg, #e6d200 0%, #8f7f00 100%)";
export const XP_COLOR = "linear-gradient(180deg, #6d6d72 0%, #3a3a3d 100%)";
// SP has no ratio to show (just a raw point count) -- flat and dark so the
// bar reads as an inert display, not a progress indicator.
export const SP_COLOR = "#1c1c1c";
