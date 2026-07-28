import { observer } from "mobx-react-lite";
import type { L2PartyMember } from "@lineage2js/network";
import { StatBar } from "../../core/stat-bar.component";
import { Slot } from "../core/slot.component";
import { ClassRoleIcon, CrownIcon } from "../../core/class-role-icon.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getClassRole } from "../../../config/class-tree";
import { CP_COLOR, HP_COLOR, MP_COLOR } from "../../../config/stat-colors";
import { getSkillIconUrl } from "../../../config/icon-urls";
import { getSkillName } from "../../../config/skill-mapping";
import { BUFF_ICON_SIZE } from "../effects/effects.window";
import { t } from "../../../lang/lang";

const BAR_WIDTH = 170;
const BAR_HEIGHT = 5;
// Half the player's own buff icon size (BUFF_ICON_SIZE, see effects.window.tsx).
const MEMBER_BUFF_ICON_SIZE = BUFF_ICON_SIZE / 2;

export interface PartyCharInfoContentProps {
  /** Not wired to anything yet -- e.g. future "set as target"/context menu. */
  onMemberClick?: (member: L2PartyMember) => void;
}

export const PartyCharInfoContent = observer(function PartyCharInfoContent({
  onMemberClick,
}: PartyCharInfoContentProps) {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {game.party.map((member) => (
        <div
          key={member.ObjectId}
          onClick={() => onMemberClick?.(member)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            width: BAR_WIDTH,
            cursor: onMemberClick ? "pointer" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ClassRoleIcon role={getClassRole(member.ClassId)} />
            <span style={{ color: "#e6d9be", fontSize: 12 }}>{member.Name}</span>
            {member.IsPartyLeader && <CrownIcon />}
          </div>
          <StatBar percent={(member.Cp / member.MaxCp) * 100} color={CP_COLOR} width={BAR_WIDTH} height={BAR_HEIGHT} />
          <StatBar percent={(member.Hp / member.MaxHp) * 100} color={HP_COLOR} width={BAR_WIDTH} height={BAR_HEIGHT} />
          <StatBar percent={(member.Mp / member.MaxMp) * 100} color={MP_COLOR} width={BAR_WIDTH} height={BAR_HEIGHT} />
          {member.Buffs.size > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {Array.from(member.Buffs).map((buff) => (
                <Slot
                  key={buff.Id}
                  type="inventory"
                  size={MEMBER_BUFF_ICON_SIZE}
                  content={{
                    type: "skill",
                    data: buff,
                    iconUrl: getSkillIconUrl(buff.Id),
                    tooltip: {
                      kind: "skill",
                      name: getSkillName(buff),
                      stats: t("tooltip.levelLabel", { level: buff.SkillLevel }),
                      expiresAt: Date.now() + buff.RemainingTime * 1000,
                      id: buff.Id,
                    },
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
