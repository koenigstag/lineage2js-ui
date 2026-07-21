import { useState } from "react";
import { observer } from "mobx-react-lite";
import type { L2Skill } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import { BaseInput } from "../../core/inputs/base.input";
import { useGameStore } from "../../../stores/StoreContext";
import { getSkillIconUrl } from "../../../config/icon-urls";
import { getSkillName } from "../../../config/skill-mapping";
import { t } from "../../../lang/lang";

const TABS = ["Active", "Passive", "Learn"] as const;
type Tab = (typeof TABS)[number];

function matchesTab(skill: L2Skill, tab: Tab): boolean {
  switch (tab) {
    case "Active":
      return skill.IsActive;
    case "Passive":
      return !skill.IsActive;
    case "Learn":
      return false;
  }
}

const GRID_COLUMNS = 8;
const SLOT_SIZE = 34;
const SLOT_GAP = 2;

const SKILL_ICON_BORDER: IconBorder = { from: "#7f8faf", to: "#31366f" };

export const SkillsContent = observer(function SkillsContent() {
  const game = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>("Active");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredSkills = game.skills.filter(
    (skill) => matchesTab(skill, activeTab) && (query === "" || getSkillName(skill).toLowerCase().includes(query))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? "#222020" : "#161513",
              color: "#e6d9be",
              border: `1px solid ${activeTab === tab ? "#a89c83" : "#76654f"}`,
              borderBottom: "none",
              borderRadius: "4px 4px 0 0",
              padding: "2px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {t(`skills.tabs.${tab}`)}
          </button>
        ))}
      </div>
      {activeTab === "Learn" ? (
        <div style={{ padding: "16px 8px", color: "#999999", fontSize: 12 }}>{t("skills.comingSoon")}</div>
      ) : (
        <>
          <BaseInput
            value={search}
            placeholder={t("skills.searchPlaceholder")}
            onChange={setSearch}
            style={{ padding: "2px 8px" }}
          />
          <div
            className="slot-grid"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${SLOT_SIZE}px)`,
              gridAutoRows: SLOT_SIZE,
              gap: SLOT_GAP,
            }}
          >
            {filteredSkills.map((skill) => (
              <Slot
                key={skill.Id}
                type="inventory"
                iconBorder={SKILL_ICON_BORDER}
                content={{
                  type: "skill",
                  data: skill,
                  iconUrl: getSkillIconUrl(skill.Id),
                  tooltip: {
                    kind: "skill",
                    name: getSkillName(skill),
                    stats: t("tooltip.levelLabel", { level: skill.Level }),
                    cost: skill.Mp,
                    id: skill.Id,
                  },
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
});
