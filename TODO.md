# Short-term TODOs
- Hotbar features - user-added shortcuts, cooldown animation, soul-shots auto-usage
- Basic Chat system
- Add a bottom menu -- unread messages count, clan menu, party, XP toggle, exp bar, adena, weight
- Show curr/total exp values in a tooltip on the character window's XP bar - frontend currently shows only the percentage, and has no level-steps info (game server does not send it).
- Add current class icon with tooltip in the character window -- currently just the "Class" text label (character.window.tsx) - depends on assets-server to serve the class icons.
- Add subclass display in the character window -- the 3 profession slots are currently static/decorative placeholders (character.window.tsx's ProfSlot), no subclass data is parsed by the network layer yet
- Inventory equip slots
- Radar
- Plain demo surface for player movement
- Movement without animation
- Basic 3D models for mobs
- Basic combat system
- Basic Quests system
- Add NPC dialog system -- render engine and actions
- Add item/skill/action descriptions -- no per-id table exists yet


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
- **Магазины/торговля**: PrivateStoreManageListSell (0xa0), PrivateStoreManageListBuy (0xbd), PrivateStoreListBuy (0xbe), ShopPreviewList (0xf5), ShopPreviewInfo (0xf6), RecipeShopSellList (0xdf), RecipeShopItemInfo (0xe0), SellListSeed (0xe9), BuyList (0xfe/0xb7), ExBuySellList (0xfe/0xb7)
- **Друзья/почта**: FriendPacket (0x76), FriendListExtended (0x58), L2FriendSay (0x78), ExNoticePostArrived (0xfe/0xa9), ExShowReceivedPostList (0xfe/0xaa), ExReplyReceivedPost (0xfe/0xab), ExShowSentPostList (0xfe/0xac), ExReplySentPost (0xfe/0xad), ExReplyPostItemList (0xfe/0xb2), ExChangePostState (0xfe/0xb3), ExNoticePostSent (0xfe/0xb4), ExGetBookMarkInfoPacket (0xfe/0x84)
- **Питомцы**: PetStatusShow (0xb1), PetItemList (0xb3), SetSummonRemainTime (0xd1), Ride (0x8c)
- **Транспорт**: GetOnVehicle (0x6e), GetOffVehicle (0x6f), MoveToLocationInVehicle (0x7e), ExAirShipInfo (0xfe/0x60), ExGetOnAirShip (0xfe/0x63), ExMoveToLocationAirShip (0xfe/0x65), ExStopMoveAirShip (0xfe/0x66), ExMoveToLocationInAirShip (0xfe/0x6d), ExAirShipTeleportList (0xfe/0x9a)
- **Клан/Pledge/Crest image**: PledgeShowMemberListAll (0x5a), PledgeShowMemberListDeleteAll (0x88), PledgeCrest (0x6a), PledgeStatusChanged (0xcd), JoinPledge (0x2d), ManagePledgePower (0x2a), PledgeSkillListAdd (0xfe/0x3b), PledgePowerGradeList (0xfe/0x3c), PledgeReceiveWarList (0xfe/0x3f), AllyCrest (0xaf), ExSubPledgeSkillAdd (0xfe/0x76), ExPledgeCrestLarge (0xfe/0x1b)
- **Siege/Fortress**: SiegeAttackers (0xca), SiegeDefenderList (0xcb), ExShowFortressInfo (0xfe/0x15), DoorStatusUpdate (0x4d), ExDominionWarStart (0xfe/0xa3), Earthquake (0xd3), OnEventTrigger (0xcf)
- **Manor/Crops**: ExShowSeedInfo (0xfe/0x23), ExShowCropInfo (0xfe/0x24), ExShowManorDefaultInfo (0xfe/0x25), ExShowSeedSetting (0xfe/0x26), ExShowCropSetting (0xfe/0x2b), ExShowSellCropList (0xfe/0x2c), ExShowProcureCropDetail (0xfe/0x78), ExShowSeedMapInfo (0xfe/0xa1)
- **Olympiad/Duel/Hero**: ExOlympiadMatchEnd (0xfe/0x2d), ExOlympiadMatchList (0xfe/0xd4), ExOlympiadMode (0xfe/0x7c), ExHeroList (0xfe/0x79), ExDuelReady (0xfe/0x4d), ExDuelStart (0xfe/0x4e), ExDuelEnd (0xfe/0x4f)
- **Enchant/Variation**: StartItemEnchanting (0x7c), EnchantResult (0x87), ExEnchantSkillResult (0xfe/0xa7), ExEnchantSkillInfo (0xfe/0x2a), ExEnchantSkillInfoDetail (0xfe/0x5e), ExShowVariationMakeWindow (0xfe/0x51), ExShowVariationCancelWindow (0xfe/0x52), ExPutItemResultForVariationMake (0xfe/0x53), ExPutIntensiveResultForVariationMake (0xfe/0x54), ExPutCommissionResultForVariationMake (0xfe/0x55), ExVariationResult (0xfe/0x56), ExPutItemResultForVariationCancel (0xfe/0x57), ExVariationCancelResult (0xfe/0x58), ExAttributeEnchantResult (0xfe/0x61), ExChooseInventoryAttributeItem (0xfe/0x62), ExShowBaseAttributeCancelWindow (0xfe/0x74), ExBaseAttributeCancelResult (0xfe/0x75), ExPutEnchantTargetItemResult (0xfe/0x81), ExPutEnchantSupportItemResult (0xfe/0x82)
- **Разное**: GameGuardQuery (0x74), QuestList (0x86), ShowMiniMap (0xa3), ObservationMode (0xeb), ObservationReturn (0xec), ChairSit (0xed), GMHennaInfo (0xf0), RadarControl (0xf1), CameraMode (0xf7), ShortBuffStatusUpdate (0xfa), PetitionVotePacket (0xfc), AgitDecoInfo (0xfd), FlyToLocation (0xd4), NetPing (0xd9), Dice (0xda), ShowCalculator (0xe2), ExRegenMax (0xfe/0x01), ExColosseumFenceInfo (0xfe/0x03), ExAutoSoulShot (0xfe/0x0c), ExSpawnEmitter (0xfe/0x5d), ExBasicActionList (0xfe/0x5f), ExAskCoupleAction (0xfe/0xbb), ExChangeNpcState (0xfe/0xbe), ExItemAuctionInfoPacket (0xfe/0x68), ExReplyDominionInfo (0xfe/0x92), ExShowOwnedThingsPosition (0xfe/0x93), ExRequestChangeNicknameColor (0xfe/0x83), ExGetDimensionalItemList (0xfe/0x86), PackageSendableList (0xd2), MagicSkillCanceled (0x49), SSQStatus (0xfb), ExShowQuestInfo (0xfe/0x20), ExShowQuestMark (0xfe/0x21)
- **Ивенты**: ExFishingStart (0xfe/0x1e), ExFishingStartCombat (0xfe/0x27), ExCursedWeaponList (0xfe/0x46), ExCursedWeaponLocation (0xfe/0x47), ExUseSharedGroupItem (0xfe/0x4a), ExStartScenePlayer (0xfe/0x99), ExCubeGameChangeTeam (0xfe/0x97), ExCubeGameRemovePlayer (0xfe/0x97), ExCubeGameChangePoints (0xfe/0x98), ExCubeGameExtendedChangePoints (0xfe/0x98), ExPCCafePointInfo (0xfe/0x32), PcCafeUI (0xfe/0x44), ExNotifyPremiumItem (0xfe/0x85), ExNotifyBirthday (0xfe/0x8f), ShowXMasSeal (0xf8), ExGetBossRecord (0xfe/0x34), ExBrLoadEventTopRankers (0xfe/0xbd), ExBrGamePoint (0xfe/0xd5), ExBrProductList (0xfe/0xd6), ExBrProductInfo (0xfe/0xd7), ExBrBuyProductResponse (0xfe/0xd8), ExBRAgathionEnergyInfo (0xfe/0xde), ExNevitAdventEffect (0xfe/0xe0)