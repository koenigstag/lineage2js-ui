# Short-term TODOs
- Add a bottom menu -- unread messages count, clan menu, party, XP toggle, exp bar, adena, weight
- Show curr/total exp values in a tooltip on the character window's XP bar -- needs the H5 per-level exp table (ExperienceData.java/.xml in the local L2J_Mobius_CT_2.6_HighFive reference) to compute the next-level threshold, since ExpPercent alone can't derive it
- Add a class icon with tooltip in the character window -- currently just the "Class" text label (character.window.tsx)
- Add subclass display in the character window -- the 3 profession slots are currently static/decorative placeholders (character.window.tsx's ProfSlot), no subclass data is parsed by the network layer yet
- Hotbar features - user-added shortcuts, cooldown animation, soul-shots auto-usage
- Inventory equip slots
- Radar
- Movement without animation
- Basic 3D models for mobs
- Basic combat system
- Basic Chat system
- Basic Quests system
- Add NPC dialog system -- render engine and actions


# Long-term TODOs
- Landscape render and textures
- Geodata system
- Minimap on radar
- Global Map
- Location Maps
- Movement on plain surface
- Geodata integration
- 3D models rewrite