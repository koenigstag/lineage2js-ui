import { PartyDistributionType } from "@lineage2js/network";
import { t } from "../lang/lang";

const LABEL_KEY: Record<PartyDistributionType, string> = {
  [PartyDistributionType.FINDERS_KEEPERS]: "party.distribution.findersKeepers",
  [PartyDistributionType.RANDOM]: "party.distribution.random",
  [PartyDistributionType.RANDOM_INCLUDING_SPOIL]: "party.distribution.randomIncludingSpoil",
  [PartyDistributionType.BY_TURN]: "party.distribution.byTurn",
  [PartyDistributionType.BY_TURN_INCLUDING_SPOIL]: "party.distribution.byTurnIncludingSpoil",
};

export function getPartyDistributionLabel(type: PartyDistributionType): string {
  const key = LABEL_KEY[type];
  return key ? t(key) : t("party.distribution.unknown");
}
