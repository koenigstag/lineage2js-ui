import { Fragment, type CSSProperties } from "react";
import { observer } from "mobx-react-lite";
import { LabeledBar } from "../../core/stat-bar.component";
import { useGameStore } from "../../../stores/StoreContext";
import { VITALITY_LEVEL_MARKERS } from "../../../stores/GameStore";
import { CP_COLOR, HP_COLOR, MP_COLOR, SP_COLOR, VITALITY_COLOR, WG_COLOR, XP_COLOR } from "../../../config/stat-colors";
import { t } from "../../../lang/lang";
import { getPledgeClassLabel } from "../../../config/pledge-class-mapping";

// Content of the "character" window (see config/windows.registry.ts's
// "character" entry) -- ported from the Figma "Content" frame
// (L2-OS file, node 51:155). Fixed-width panel, not a flexible sidebar like
// char-info/party-char-info, so it uses its own layout instead of
// CharacterVitals/CharacterInfoMenu.
//
// Decorative dividers/plate textures from the Figma export (thin separator
// lines, the profession-slot bevel) are recreated with plain CSS borders/
// gradients here instead of downloading the exported PNG assets -- per
// CLAUDE.md, this repo never fetches or commits real L2/NCsoft art, even as
// placeholders sourced from the design file.
const PANEL_WIDTH = 330;
const BORDER_COLOR = "#272422";
const TEXT_SHADOW = "1px 0.5px 0 rgba(0, 0, 0, 0.9)";

// Plain 10% ticks -- XP has no level-like breakpoints of its own, just a
// steady progress readout.
const XP_MARKERS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const panelStyle: CSSProperties = {
  backgroundColor: "#181818",
  border: `1px solid ${BORDER_COLOR}`,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 6,
  width: PANEL_WIDTH,
  boxSizing: "border-box",
};

const statsFrameStyle: CSSProperties = {
  backgroundColor: "rgba(24, 24, 24, 0.8)",
  border: `1px solid ${BORDER_COLOR}`,
  display: "flex",
  gap: 7,
  padding: 6,
  width: PANEL_WIDTH,
  boxSizing: "border-box",
};

const sectionTitleStyle: CSSProperties = { color: "#d2d2d2", fontSize: 12, textShadow: TEXT_SHADOW };
const rowLabelStyle: CSSProperties = { color: "#a2a2a2", fontSize: 11, textShadow: TEXT_SHADOW };
const rowValueStyle: CSSProperties = { color: "#9b876c", fontSize: 11, textShadow: TEXT_SHADOW };

type StatRowTuple = [label: string, value: string | number];

function InfoRow({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }} onClick={onClick}>
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>{value}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>{value}</span>
    </div>
  );
}

function StatColumn({ rows }: { rows: StatRowTuple[] }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      {rows.map(([label, value]) => (
        <StatRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function ColumnDivider() {
  return <div style={{ alignSelf: "stretch", width: 1, backgroundColor: BORDER_COLOR, flexShrink: 0 }} />;
}

function StatsSection({ title, columns }: { title: string; columns: StatRowTuple[][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={statsFrameStyle}>
        {columns.map((rows, index) => (
          <Fragment key={index}>
            {index > 0 && <ColumnDivider />}
            <StatColumn rows={rows} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// Profession/subclass slots -- always shown locked. No subclass data is
// parsed by the network layer yet, so these are purely decorative chrome
// matching the design (see the Figma frame's static "profs" placeholders).
function ProfSlot() {
  const style: CSSProperties = {
    width: 20,
    height: 27,
    borderRadius: 1,
    border: "1px solid #0c0d0c",
    background: "linear-gradient(180deg, #3a3c36 0%, #23241f 100%)",
    boxShadow: "inset 0 8px 10px rgba(23, 24, 22, 0.6), 0 1px 1px rgba(78, 78, 78, 0.6)",
    flexShrink: 0,
  };
  return <div style={style} />;
}

// Empty portrait placeholder -- there's no character-portrait asset/pipeline
// anywhere in this codebase yet (see icon-frame.component.tsx's iconUrl
// fallback for the equivalent treatment on skill/item icons).
function PortraitPlaceholder() {
  const style: CSSProperties = {
    width: 33,
    height: 44,
    flexShrink: 0,
    backgroundColor: "#0d0d0d",
    border: `1px solid ${BORDER_COLOR}`,
    boxSizing: "border-box",
  };
  return <div style={style} />;
}

function Divider() {
  return <div style={{ height: 1, width: "100%", backgroundColor: BORDER_COLOR }} />;
}

// CharSelected (the first packet to trigger syncCharInfo, see GameStore.ts)
// only parses name/objectId/title/sex/race/classId/position/hp/mp -- fields
// like ExpFraction/Load stay undefined until the follow-up UserInfo packet
// arrives a moment later. `value || 0` tolerates that gap instead of
// crashing on undefined.toFixed().
function formatPercent(value: number) {
  return `${(value || 0).toFixed(2)}%`;
}

// Appends the equipped-Henna delta in parentheses, matching the design's
// "STR 57 (+12)" / "CON 34 (-12)" -- each dye trades a bonus on one stat for
// a penalty on another (see CharInfoSnapshot.hennaStr's comment), so this
// can go either way. Omitted entirely at exactly 0 (the legitimate "no
// Henna applied" state, not a "not loaded yet" placeholder).
function formatStat(value: number, hennaDelta: number): string {
  if (hennaDelta === 0) {
    return `${value}`;
  }
  return `${value} (${hennaDelta > 0 ? "+" : ""}${hennaDelta})`;
}

export const CharacterContent = observer(function CharacterContent() {
  const game = useGameStore();
  const info = game.charInfo;

  const clanName = info.clanId ? game.pledgeCache.get(info.clanId)?.ClanName : undefined;
  const loadPercent = info.maxLoad > 0 ? (info.load / info.maxLoad) * 100 : 0;

  const firstColumn: StatRowTuple[] = [
    [t("charInfo.pAtk"), info.pAtk],
    [t("charInfo.pDef"), info.pDef],
    [t("charInfo.pAccuracy"), info.accuracy],
    [t("charInfo.pCritical"), info.critical],
    [t("charInfo.atkSpd"), info.atkSpd],
  ];

  // mAccuracy/mEvasion/mCritical are undefined outside demo mode (see the
  // CharInfoSnapshot field comments) -- appended at the end when available
  // instead of showing a misleading 0 for a stat the network layer never
  // actually reported.
  const secondColumn = (
    [
      [t("charInfo.mAtk"), info.mAtk],
      [t("charInfo.mDef"), info.mDef],
      [t("charInfo.pEvasion"), info.evasion],
      [t("charInfo.speed"), info.speed],
      [t("charInfo.castingSpd"), info.castingSpd],
      [t("charInfo.mAccuracy"), info.mAccuracy],
      [t("charInfo.mEvasion"), info.mEvasion],
      [t("charInfo.mCritical"), info.mCritical],
    ] as [string, number | undefined][]
  ).filter((row): row is [string, number] => row[1] !== undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: PANEL_WIDTH }}>
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PortraitPlaceholder />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <div style={{ color: "#eeefee", fontSize: 11, textShadow: TEXT_SHADOW }} onClick={() => game.selectSelfAsTarget()}>
              {info.name}
            </div>
            <InfoRow label={t("charInfo.clan")} value={clanName ?? t("charInfo.noClan")} />
            <div style={{ display: "flex", gap: 10 }}>
              <InfoRow label={t("charInfo.level")} value={info.level} onClick={() => game.selectSelfAsTarget()} />
              <InfoRow label={t("charInfo.status")} value={getPledgeClassLabel(info.pledgeClass)} />
            </div>
          </div>
        </div>
        <Divider />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <InfoRow label={t("charInfo.class")} value={info.className} />
          <div style={{ display: "flex", gap: 8 }}>
            <ProfSlot />
            <ProfSlot />
            <ProfSlot />
          </div>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 156 }}>
            <LabeledBar label={t("charInfo.hp")} percent={(info.hp / info.maxHp) * 100} text={`${info.hp}/${info.maxHp}`} color={HP_COLOR} width={128} />
            <LabeledBar label={t("charInfo.mp")} percent={(info.mp / info.maxMp) * 100} text={`${info.mp}/${info.maxMp}`} color={MP_COLOR} width={128} />
            <LabeledBar label={t("charInfo.vp")} percent={info.vitalityPercent} color={VITALITY_COLOR} width={128} dividers={VITALITY_LEVEL_MARKERS} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, width: 150 }}>
            <LabeledBar label={t("charInfo.cp")} percent={(info.cp / info.maxCp) * 100} text={`${info.cp}/${info.maxCp}`} color={CP_COLOR} width={122} />
            <LabeledBar label={t("charInfo.wg")} percent={loadPercent} text={formatPercent(loadPercent)} color={WG_COLOR} width={122} />
            <LabeledBar label={t("charInfo.sp")} percent={100} text={`${info.sp}`} color={SP_COLOR} width={122} />
          </div>
        </div>
        <LabeledBar label={t("charInfo.xp")} percent={info.expPercent || 0} text={formatPercent(info.expPercent)} color={XP_COLOR} width={290} dividers={XP_MARKERS} />
      </div>

      <StatsSection
        title={t("charInfo.combatStats")}
        columns={[firstColumn, secondColumn]}
      />

      <StatsSection
        title={t("charInfo.basicStats")}
        columns={[
          [
            [t("charInfo.stat.str"), formatStat(info.str, info.hennaStr)],
            [t("charInfo.stat.int"), formatStat(info.int, info.hennaInt)],
          ],
          [
            [t("charInfo.stat.dex"), formatStat(info.dex, info.hennaDex)],
            [t("charInfo.stat.wit"), formatStat(info.wit, info.hennaWit)],
          ],
          [
            [t("charInfo.stat.con"), formatStat(info.con, info.hennaCon)],
            [t("charInfo.stat.men"), formatStat(info.men, info.hennaMen)],
          ],
        ]}
      />

      <StatsSection
        title={t("charInfo.social")}
        columns={[
          [
            [t("charInfo.pvpPk"), `${info.pvpKills} / ${info.pkKills}`],
            [t("charInfo.reputation"), info.fame],
          ],
          [
            [t("charInfo.karma"), info.karma],
            [t("charInfo.recommendations"), `${info.recommHave} / ${info.recommLeft}`],
          ],
        ]}
      />
    </div>
  );
});
