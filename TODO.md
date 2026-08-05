# Short-term TODOs
- Hotbar features - user-added shortcuts, cooldown animation, soul-shots auto-usage
- Improve chat system
- Add a bottom menu -- unread messages count, clan menu, party, XP toggle, exp bar, adena, weight
- Show curr/total exp values in a tooltip on the character window's XP bar - frontend currently shows only the percentage, and has no level-steps info (game server does not send it).
- Add current class icon with tooltip in the character window -- currently just the "Class" text label (character.window.tsx) - depends on assets-server to serve the class icons.
- Add subclass display in the character window -- the 3 profession slots are currently static/decorative placeholders (character.window.tsx's ProfSlot), no subclass data is parsed by the network layer yet
- Inventory equip slots
- Item grade in tooltips -- L2Item.Grade is never populated; confirmed against both lineage2ts's and L2J_Mobius's writeItem/AbstractItemPacket that grade (crystal_type) is never serialized onto the wire for any item packet (ItemList/InventoryUpdate/TradeStart/warehouse/...), only used server-side for filtering/sorting and soulshot-vs-weapon grade matching (SoulShots.ts/RequestAutoSoulShot.ts's `weapon.getItem().getItemGradeSPlus() === item.getItem().getItemGradeSPlus()` checks -- that validation stays entirely server-side regardless, no client-side grade data needed for correctness, only for UX). Same class of gap as npc races/levels (see DatapackStore.loadNpcRaces()'s comment) -- needs a `public/item-grades/data.json` (id -> grade) generated once from L2J_Mobius's item stat XML (`crystal_type` field, e.g. `dist/game/data/stats/items/*.xml`) plus a `DatapackStore.loadItemGrades()` following the exact same fetch-once/cache pattern as loadNpcRaces(), wired into `getItemGradeLabel` (config/item-mapping.ts).
- Radar
- Real player movement with server packets -- geo-terrain-debug-scene.component.tsx is currently a dev-only local harness (WASD/click-to-move drives a local TestCharacterState), not wired to CommandMoveTo/MoveToLocation/ValidateLocation/StopMove
- Movement without animation
- Basic 3D models for mobs -- CreatureModel (components/core/scene/creature-model.component.tsx) is the extension point: its non-player branch currently just tints the same placeholder capsule by NpcRace, swap that branch's return for real per-archetype geometry when it exists, no caller changes needed
- Equipped armor/weapon visuals -- needed for both players and NPCs/mobs, rendered through CreatureModel/PlayerModel once there's something to render them with:
  - Parsing/storage done: a single unified L2Creature.Paperdoll (25-slot display id array, index = GameServerPacket.PAPERDOLL_*), shared by every creature kind so a caller never needs to know or care what it has -- CharInfo.ts (other players) and UserInfo.ts (local player, which carries the same data across three parallel PAPERDOLL_ORDER arrays -- ObjectId/ItemId/AugmentationId, confirmed against lineage2ts's own UserInfo.ts -- only the ItemId one is stored, matching CharInfo's single array) populate all 25 slots; NpcInfo.ts (NPCs/mobs) populates just the RHAND/CHEST/LHAND indices of that same array.
  - Local player's actual inventory (not just display ids) is separately available too: client.InventoryItems, filter IsEquipped, BodyPart is the paperdoll slot bitmask (L2Item.SLOT_* constants).
  - Still missing: an actual asset/model lookup (icon vs. 3D geometry) to render anything beyond a color from these ids -- no such pipeline exists yet, likely the same "no character art yet" situation as the current procedural CharacterModel placeholder. WorldCreatureSnapshot doesn't carry the ids yet either (add if/when a rendering plan exists, no point exposing unused data to the UI store).
- Basic combat system
- Basic Quests system
- Add NPC dialog system -- render engine and actions
- Add item/skill/action descriptions -- no per-id table exists yet
- Add the other revive points to the death modal (death-modal.tsx currently only offers RestartPoint.TOWN) -- Clan Hall/Castle/Fortress/Siege HQ/Fixed/Agathion need ownership/availability data (clan hall or castle ownership, siege participation, Fixed-point item, Agathion state) that isn't modeled anywhere in this client yet
- Remaining confirm-dialog flows, each blocked on a parent feature that doesn't exist yet: friend invite (Friends List), party room join (party-matching rooms), command channel invite (RequestExAskJoinMPCC), pledge war surrender confirm (clan war), and ConfirmDlgType.CONFIRM_EXECUTE_COMMAND's generic bypass-command prompts (NPC dialog/bypass system)
- Private Store search window and Mini-Game (Cube Game) HUD -- Actions FIND_STORE/MINI_GAME (user-actions.ts) stay icon-only until these exist; neither has a request packet at all (confirmed against RequestActionUse.java's switch and the ExCubeGame* server-push packets), so there's nothing to wire until the window itself is built
- Multi-layer geodata (bridges/tunnels, multiple Z per cell) -- l2j-region-parser.ts currently collapses MultiLayer blocks to a single representative height (the highest layer), since GeoTile only models one height per cell. Settled design for real support (not yet implemented):
  - GeoTile gets additive CSR-style layer fields alongside the existing heights/nswe (which stay as the "top layer" fast path for consumers like geo-tile-height.ts that don't care about layers): layerCounts (Uint8Array per cell), layerOffsets (Uint32Array per cell + 1, prefix-sum into the flattened arrays below), layerHeights/layerNswe (Int16Array/Uint8Array, flattened across all layers in the tile/region).
  - l2j-region-parser.ts writes the full per-cell layer list into these CSR fields for MultiLayer blocks (still also writes the top layer into heights/nswe for the fast path).
  - slice-geo-tile.ts recomputes CSR offsets for the sliced sub-region (not a straight subarray copy like heights/nswe).
  - geo-terrain-tile.component.tsx's mesh builder reconstructs disconnected "sheets" instead of always building one fully-connected grid: treat (cell, layer) as a graph node, connect to a neighbor's layer only when the NSWE bit for that direction isn't blocked (NSWE is already the connectivity signal -- no separate heuristic needed) and its height is the closest match; flood-fill/union-find the connected components, each becomes its own disjoint index buffer (a bridge deck and the ground under it end up as two separate meshes). Where every cell has exactly one layer (the common case), this degenerates to today's single connected grid -- no separate code path for "normal" vs "multi-layer" terrain.
- generate-geodata.ts (assets-server) still emits the old per-tile .bin format, not raw .l2j region files -- stale relative to l2j-region-parser.ts/use-geo-tiles.ts's region-based fetch+slice pipeline; needs updating to emit synthetic .l2j regions (or removal) so local dev/testing without a real geodata source still works
- VITE_IS_DEMO_MODE build-time flag -- run the *entire* flow (login, server select, character select/create, world enter) on fake data, not just the game screen. Settled design (not yet implemented):
  - GameStore already has this "offline mode" pattern for individual actions (recommend/reviveAtTown/learnSelectedSkill/sendChatMessage: if connected, real client.xxx() call; else simulate the result locally) -- extend the same pattern one layer earlier, into SessionStore, which currently has none: login()/selectServer()/selectCharacter()/createCharacter()/restart() always `await this.client.X(...)`, which just hangs/rejects without a real server.
  - Under the flag, those SessionStore methods take a demo branch returning fabricated results (fake server list, fake character roster, successful select/create/enter) instead of awaiting the real client call -- the existing screens (login/char-select/create-char/game) don't change at all, they just run against fake data the same way GameStore's demo fallbacks already do.
  - Rejected alternative: a login-screen "Demo Mode" button that skips straight to ui.setScreen("game") -- simpler, but skips exercising login/char-select/create-char themselves, which this is explicitly meant to cover too.


# Long-term TODOs
- Landscape render and textures
- Geodata system
- Minimap on radar
- Global Map
- Location Maps
- Movement on real surface
- Geodata integration
- 3D models rewrite
- Clan window


# Unhandled packets

Opcodes lineage2ts's server sends (`game-server/source/gameService/packets/send`)
that `GamePacketHandler.ts` doesn't parse yet -- falls into its default no-op
instead of a `Packets.*` class. Grouped by feature area; `0xNN/0xMM` is the
`0xFE`-family main/sub opcode pair.

- **Char delete**: CharacterDeleteSuccess (0x1d), CharacteDeleteFail (0x1e)
- **Party**: ListPartyWaiting (0x9c), ExPartyRoomMember (0xfe/0x08), ExClosePartyRoom (0xfe/0x09), ExListPartyMatchingWaitingRoom (0xfe/0x36), ExOpenMPCC (0xfe/0x12), ExCloseMPCC (0xfe/0x13), ExMPCCShowPartyMemberInfo (0xfe/0x4b), ExSetPartyLooting (0xfe/0xc0)
- **Shops/Trade**: PrivateStoreManageListSell (0xa0), PrivateStoreManageListBuy (0xbd), PrivateStoreListBuy (0xbe), ShopPreviewList (0xf5), ShopPreviewInfo (0xf6), RecipeShopSellList (0xdf), RecipeShopItemInfo (0xe0), SellListSeed (0xe9), BuyList (0xfe/0xb7), ExBuySellList (0xfe/0xb7)
- **Friends/Mail**: FriendPacket (0x76), FriendListExtended (0x58), L2FriendSay (0x78), ExNoticePostArrived (0xfe/0xa9), ExShowReceivedPostList (0xfe/0xaa), ExReplyReceivedPost (0xfe/0xab), ExShowSentPostList (0xfe/0xac), ExReplySentPost (0xfe/0xad), ExReplyPostItemList (0xfe/0xb2), ExChangePostState (0xfe/0xb3), ExNoticePostSent (0xfe/0xb4), ExGetBookMarkInfoPacket (0xfe/0x84)
- **Pets**: PetStatusShow (0xb1), PetItemList (0xb3), SetSummonRemainTime (0xd1), Ride (0x8c)
- **Vehicles**: GetOnVehicle (0x6e), GetOffVehicle (0x6f), MoveToLocationInVehicle (0x7e), ExAirShipInfo (0xfe/0x60), ExGetOnAirShip (0xfe/0x63), ExMoveToLocationAirShip (0xfe/0x65), ExStopMoveAirShip (0xfe/0x66), ExMoveToLocationInAirShip (0xfe/0x6d), ExAirShipTeleportList (0xfe/0x9a)
- **Clan/Pledge/Crest image**: PledgeShowMemberListAll (0x5a), PledgeShowMemberListDeleteAll (0x88), PledgeCrest (0x6a), PledgeStatusChanged (0xcd), JoinPledge (0x2d), ManagePledgePower (0x2a), PledgeSkillListAdd (0xfe/0x3b), PledgePowerGradeList (0xfe/0x3c), PledgeReceiveWarList (0xfe/0x3f), AllyCrest (0xaf), ExSubPledgeSkillAdd (0xfe/0x76), ExPledgeCrestLarge (0xfe/0x1b)
- **Siege/Fortress**: SiegeAttackers (0xca), SiegeDefenderList (0xcb), ExShowFortressInfo (0xfe/0x15), DoorStatusUpdate (0x4d), ExDominionWarStart (0xfe/0xa3), Earthquake (0xd3), OnEventTrigger (0xcf)
- **Manor/Crops**: ExShowSeedInfo (0xfe/0x23), ExShowCropInfo (0xfe/0x24), ExShowManorDefaultInfo (0xfe/0x25), ExShowSeedSetting (0xfe/0x26), ExShowCropSetting (0xfe/0x2b), ExShowSellCropList (0xfe/0x2c), ExShowProcureCropDetail (0xfe/0x78), ExShowSeedMapInfo (0xfe/0xa1)
- **Olympiad/Duel/Hero**: ExOlympiadMatchEnd (0xfe/0x2d), ExOlympiadMatchList (0xfe/0xd4), ExOlympiadMode (0xfe/0x7c), ExHeroList (0xfe/0x79), ExDuelReady (0xfe/0x4d), ExDuelStart (0xfe/0x4e), ExDuelEnd (0xfe/0x4f)
- **Enchant/Variation**: StartItemEnchanting (0x7c), EnchantResult (0x87), ExEnchantSkillResult (0xfe/0xa7), ExEnchantSkillInfo (0xfe/0x2a), ExEnchantSkillInfoDetail (0xfe/0x5e), ExShowVariationMakeWindow (0xfe/0x51), ExShowVariationCancelWindow (0xfe/0x52), ExPutItemResultForVariationMake (0xfe/0x53), ExPutIntensiveResultForVariationMake (0xfe/0x54), ExPutCommissionResultForVariationMake (0xfe/0x55), ExVariationResult (0xfe/0x56), ExPutItemResultForVariationCancel (0xfe/0x57), ExVariationCancelResult (0xfe/0x58), ExAttributeEnchantResult (0xfe/0x61), ExChooseInventoryAttributeItem (0xfe/0x62), ExShowBaseAttributeCancelWindow (0xfe/0x74), ExBaseAttributeCancelResult (0xfe/0x75), ExPutEnchantTargetItemResult (0xfe/0x81), ExPutEnchantSupportItemResult (0xfe/0x82)
- **UI key mapping** (VK-code hotkey binds, distinct from hotbar shortcut *contents* which are already handled via ShortCutInit/Register/Delete): ExUISetting (0xfe/0x70) unhandled incoming; RequestKeyMapping (Ex 0x21) / RequestSaveKeyMapping (Ex 0x22) not implemented at all outgoing either. L2J_Mobius treats the payload as an opaque byte blob (stored verbatim in `character_variables` under `UI_KEY_MAPPING`, server never parses it), but lineage2ts's own `RequestSaveKeyMapping.ts`/`ExUISetting.ts` decode/encode the real structure: `skip 2×D` header, `tabCount:D`, then per tab two `C`-sized category-id arrays (`C[]`) followed by `keySize:D` `ActionKey` entries of `{ commandId:D, key:D, toggleKeyOne:D, toggleKeyTwo:D, visibleStatus:D }` -- `commandId` is a UI Action id (same concept as this project's Actions window), `key`/`toggleKeyOne`/`toggleKeyTwo` are the actual VK codes (primary + up to 2 alt binds), `visibleStatus` toggles action-bar visibility. Implementing this needs our own category/ActionKey table, not just a raw passthrough blob.
- **Misc**
  - GameGuardQuery (0x74) -- anti-cheat client challenge (legacy GameGuard handshake, not relevant to a browser client)
  - MagicSkillCanceled (0x49) -- stops a skill's cast animation on the client mid-cast
  - QuestList (0x86) -- full list of the player's active/completed quests
  - SendMacroList (0xe8) -- account macro list, sent unprompted right after world-enter alongside ItemList/SkillList (confirmed on the wire: opcode 0xe8, 8-byte empty-list payload)
  - PlaySound (0x9e) -- plays a named sound effect client-side (also seen twice, unprompted, in the same world-enter burst)
  - ExShowQuestInfo (0xfe/0x20) -- toggles the quest-tracker UI panel
  - ExShowQuestMark (0xfe/0x21) -- marks a quest-related NPC/location on the map
  - PackageSendableList (0xd2) -- items eligible for Freight (parcel-send to another character)
  - ShowMiniMap (0xa3) -- opens the minimap overlay, tagged with the current Seven Signs period
  - RadarControl (0xf1) -- add/remove/clear a radar waypoint marker
  - CameraMode (0xf7) -- switches 1st/3rd-person camera
  - FlyToLocation (0xd4) -- knockback/charge/throw forced-movement effect
  - ObservationMode (0xeb) -- enter spectator mode (death/GM observation) at a location
  - ObservationReturn (0xec) -- return from spectator mode to the body's location
  - ChairSit (0xed) -- sit animation on a static chair/throne object
  - Dice (0xda) -- dice-roll emote result
  - ShowCalculator (0xe2) -- opens the in-client crafting calculator
  - PetitionVotePacket (0xfc) -- GM petition satisfaction survey prompt
  - GMHennaInfo (0xf0) -- henna dye-stat breakdown shown in the GM panel
  - AgitDecoInfo (0xfd) -- clan hall ("Agit") interior decoration/function list
  - SSQStatus (0xfb) -- Seven Signs quest status pages
  - NetPing (0xd9) -- periodic latency probe
  - ExRegenMax (0xfe/0x01) -- timed HP-regen-over-time effect ticks
  - ExColosseumFenceInfo (0xfe/0x03) -- Olympiad arena fence/barrier state
  - ExAutoSoulShot (0xfe/0x0c) -- server ack for the auto-soulshot toggle
  - ExSpawnEmitter (0xfe/0x5d) -- spawns a particle-effect emitter tied to an NPC
  - ExChangeNpcState (0xfe/0xbe) -- visual NPC state-flag change (e.g. siege golem/machine states)
  - ExItemAuctionInfoPacket (0xfe/0x68) -- item auction house listing state
  - ExReplyDominionInfo (0xfe/0x92) -- Territory War dominion/ward ownership state
  - ExShowOwnedThingsPosition (0xfe/0x93) -- Territory War ward marker positions on the map
  - ExRequestChangeNicknameColor (0xfe/0x83) -- nickname color change (event/GM reward)
  - ExGetDimensionalItemList (0xfe/0x86) -- Dimensional Merchant's transferable-item list
- **Events**: ExFishingStart (0xfe/0x1e), ExFishingStartCombat (0xfe/0x27), ExCursedWeaponList (0xfe/0x46), ExCursedWeaponLocation (0xfe/0x47), ExUseSharedGroupItem (0xfe/0x4a), ExStartScenePlayer (0xfe/0x99), ExCubeGameChangeTeam (0xfe/0x97), ExCubeGameRemovePlayer (0xfe/0x97), ExCubeGameChangePoints (0xfe/0x98), ExCubeGameExtendedChangePoints (0xfe/0x98), ExPCCafePointInfo (0xfe/0x32), PcCafeUI (0xfe/0x44), ExNotifyPremiumItem (0xfe/0x85), ExNotifyBirthday (0xfe/0x8f), ShowXMasSeal (0xf8), ExGetBossRecord (0xfe/0x34), ExBrLoadEventTopRankers (0xfe/0xbd), ExBrGamePoint (0xfe/0xd5), ExBrProductList (0xfe/0xd6), ExBrProductInfo (0xfe/0xd7), ExBrBuyProductResponse (0xfe/0xd8), ExBRAgathionEnergyInfo (0xfe/0xde), ExNevitAdventEffect (0xfe/0xe0)
