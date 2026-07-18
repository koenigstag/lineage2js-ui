import { makeAutoObservable } from "mobx";

export interface Character {
  id: string;
  nickname: string;
  race: string;
  baseClass: string;
  sex: string;
  face: string;
  hair: string;
}

export interface Creature {
  id: string;
}

export const MAX_CHARACTERS = 7;

const CHARACTERS_KEY = "characters";

// Temporary local persistence until characters are served by the game server.
function loadCharacters(): Map<string, Character> {
  const raw = localStorage.getItem(CHARACTERS_KEY);
  const characters: Character[] = raw ? JSON.parse(raw) : [];
  return new Map(characters.map((character) => [character.id, character]));
}

function persistCharacters(characters: Map<string, Character>): void {
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(Array.from(characters.values())));
}

export class GameStore {
  characters = loadCharacters();
  creatures = new Map<string, Creature>();
  me: string | undefined = undefined;
  selectedCharacterId: string | undefined = undefined;

  constructor() {
    makeAutoObservable(this);
  }

  selectCharacter(id: string | undefined) {
    this.selectedCharacterId = id;
  }

  createCharacter(data: Omit<Character, "id">): string {
    const id = crypto.randomUUID();
    this.characters.set(id, { id, ...data });
    persistCharacters(this.characters);
    return id;
  }

  deleteCharacter(id: string) {
    this.characters.delete(id);
    if (this.selectedCharacterId === id) {
      this.selectedCharacterId = undefined;
    }
    persistCharacters(this.characters);
  }

  enterWorld() {
    this.me = this.selectedCharacterId;
  }
}
