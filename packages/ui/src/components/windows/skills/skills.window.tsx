import { useState } from "react";
import { observer } from "mobx-react-lite";
import { ShortcutType, type L2Skill } from "@lineage2js/network";
import { SkillSlot } from "../core/skill-slot.component";
import { setHotbarDragPayload } from "../core/dnd";
import { BaseInput } from "../../core/inputs/base.input";
import { useGameStore, useWindowManagerStore } from "../../../stores/StoreContext";
import { getSkillName } from "../../../config/skill-mapping";
import type { LearnableSkillSnapshot } from "../../../stores/GameStore";
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

export const SkillsContent = observer(function SkillsContent() {
  const game = useGameStore();
  const windowManager = useWindowManagerStore();
  const [activeTab, setActiveTab] = useState<Tab>("Active");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredSkills = game.skills.filter(
    (skill) => matchesTab(skill, activeTab) && (query === "" || getSkillName(skill).toLowerCase().includes(query))
  );

  // Opens the "skill" detail window pinned to the right of this window's
  // current (possibly user-dragged) position, rather than a static default.
  function handleLearnableClick(skill: LearnableSkillSnapshot) {
    game.selectLearnableSkill(skill);
    const rect = document.getElementById("skills-list")?.getBoundingClientRect();
    if (rect) {
      windowManager.move("skill", rect.right + 8, rect.top);
    }
    windowManager.open("skill");
  }

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
        <div
          className="slot-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${SLOT_SIZE}px)`,
            gridAutoRows: SLOT_SIZE,
            gap: SLOT_GAP,
          }}
        >
          {game.learnableSkills.map((skill) => (
            <SkillSlot
              key={`${skill.id}-${skill.level}`}
              id={skill.id}
              level={skill.level}
              detail="full"
              onClick={() => handleLearnableClick(skill)}
            />
          ))}
        </div>
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
              <div
                key={skill.Id}
                draggable
                onDragStart={(e) => setHotbarDragPayload(e, ShortcutType.SKILL, skill.Id, skill.Level)}
              >
                <SkillSlot
                  id={skill.Id}
                  level={skill.Level}
                  cost={skill.Mp}
                  expiresAt={skill.IsReady ? undefined : Date.now() + skill.Remaining}
                  detail="full"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
