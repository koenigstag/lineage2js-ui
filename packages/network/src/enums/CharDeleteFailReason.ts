/**
 * Why the server refused a character deletion (CharDeleteFail). Numeric ids
 * match lineage2ts's own CharacterDeleteReasons -- note they start at 1, not
 * 0, unlike CharCreateFailReason.
 */
export enum CharDeleteFailReason {
  REASON_DELETE_FAILED = 0x01,
  REASON_YOU_MAY_NOT_DELETE_CLAN_MEMBER = 0x02,
  REASON_CLAN_LEADERS_MAY_NOT_BE_DELETED = 0x03,
}
