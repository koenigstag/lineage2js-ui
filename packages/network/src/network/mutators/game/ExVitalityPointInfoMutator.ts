import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ExVitalityPointInfo from "../../incoming/game/ExVitalityPointInfo";

export default class ExVitalityPointInfoMutator extends IMMOClientMutator<
  GameClient,
  ExVitalityPointInfo
> {
  update(packet: ExVitalityPointInfo): void {
    this.Client.ActiveChar.VitalityPoints = packet.VitalityPoints;
  }
}
