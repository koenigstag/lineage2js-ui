import { ClassId } from "../../../enums/ClassId";
import { Race } from "../../../enums/Race";
import GameClientPacket from "./GameClientPacket";

export interface CharacterTemplate {
  Race: Race;
  ClassId: ClassId;
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIT: number;
  MEN: number;
}

export default class RequestNewCharacterSuccess extends GameClientPacket {
  Templates: CharacterTemplate[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    const size = this.readD();

    // Each template is 20 D-words: race, classId, then (max, base, min) for
    // each of STR/DEX/CON/INT/WIT/MEN in that order -- see the reference
    // server's send/NewCharacter.ts. The previous version of this parser only
    // read 18 words per template (missing the STR max and MEN min reads),
    // which misaligned every field from the second word on, and made every
    // template after the first read pure garbage off the wire.
    for (let i = 0; i < size; i++) {
      const race = (Race as any)[this.readD()];
      const classId = (ClassId as any)[this.readD()];

      const _strMax = this.readD();
      const str = this.readD();
      const _strMin = this.readD();

      const _dexMax = this.readD();
      const dex = this.readD();
      const _dexMin = this.readD();

      const _conMax = this.readD();
      const con = this.readD();
      const _conMin = this.readD();

      const _intMax = this.readD();
      const int = this.readD();
      const _intMin = this.readD();

      const _witMax = this.readD();
      const wit = this.readD();
      const _witMin = this.readD();

      const _menMax = this.readD();
      const men = this.readD();
      const _menMin = this.readD();

      this.Templates.push({
        Race: race,
        ClassId: classId,
        STR: str,
        DEX: dex,
        CON: con,
        INT: int,
        WIT: wit,
        MEN: men,
      });
    }

    return true;
  }
}
