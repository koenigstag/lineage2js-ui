// Stacking order: tooltips > modals > windows > menus > screens. Within
// "modals", the connection-state overlays have their own fixed order --
// disconnect (a dead socket makes everything else moot) sits above the
// "confirm" tier (resurrect/party-invite/trade-request -- live prompts
// worth answering) which sits above death (just an idle status while
// dead) -- see disconnect-modal.tsx, the "resurrect"/"party-invite"/
// "trade-request" window entries in windows.registry.ts, and death-modal.tsx.
export const MENU_Z_INDEX = 1;
export const MODAL_Z_INDEX = 100000;
export const DEATH_Z_INDEX = 100010;
export const CONFIRM_WINDOW_Z_INDEX = 100020;
export const DISCONNECT_Z_INDEX = 100030;
export const TOOLTIP_Z_INDEX = 200000;
