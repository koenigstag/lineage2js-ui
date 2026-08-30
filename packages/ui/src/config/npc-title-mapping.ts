import { rootStore } from "../stores/RootStore";

/**
 * npcId -> title ("Blacksmith", "Grand Master", ...), the rank line the retail
 * client stacks above an npc's name.
 *
 * Needed for the same reason npc-name-mapping.ts is: NpcInfo does carry a
 * title field, but the server deliberately sends it empty. lineage2ts's
 * NpcData sets `usingServerSideTitle = false` on every template, and
 * L2Npc.getGeneratedTitle() only returns the template's own title when that
 * flag is on -- otherwise it falls through to L2Character.getTitle(), which
 * is literally `return ''`. That isn't a server bug: the retail client
 * resolves the title from its own local npc table, which is exactly what
 * this one stands in for (confirmed live -- the original client shows
 * titles against the very same server that sends us nothing).
 *
 * Reactive read off DatapackStore rather than baked onto the entity, since
 * the table loads asynchronously -- same treatment as getNpcName().
 */
export function tryGetNpcTitle(npcId: number): string | undefined {
  return rootStore.datapack.npcTitles[npcId];
}
