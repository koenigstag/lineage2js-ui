import CommandAcceptJoinParty from "./CommandAcceptJoinParty";
import CommandAcceptResurrect from "./CommandAcceptResurrect";
import CommandAction from "./CommandAction";
import CommandAttack from "./CommandAttack";
import CommandAutoShots from "./CommandAutoShots";
import CommandCancelBuff from "./CommandCancelBuff";
import CommandCancelTarget from "./CommandCancelTarget";
import CommandCast from "./CommandCast";
import CommandCraft from "./CommandCraft";
import CommandCreateCharacter from "./CommandCreateCharacter";
import CommandDeclineJoinParty from "./CommandDeclineJoinParty";
import CommandDeclineResurrect from "./CommandDeclineResurrect";
import CommandDropItem from "./CommandDropItem";
import CommandDwarvenCraftRecipes from "./CommandDwarvenCraftRecipes";
import CommandHit from "./CommandHit";
import CommandInventory from "./CommandInventory";
import CommandLogin from "./CommandLogin";
import CommandLogout from "./CommandLogout";
import CommandMoveTo from "./CommandMoveTo";
import CommandNextTarget from "./CommandNextTarget";
import CommandRequestBypass from "./CommandRequestBypass";
import CommandRequestDuel from "./CommandRequestDuel";
import CommandRequestCharacterTemplates from "./CommandRequestCharacterTemplates";
import CommandRequestJoinParty from "./CommandRequestJoinParty";
import CommandRevive from "./CommandRevive";
import CommandSay from "./CommandSay";
import CommandSayToAlly from "./CommandSayToAlly";
import CommandSayToClan from "./CommandSayToClan";
import CommandSayToParty from "./CommandSayToParty";
import CommandSayToTrade from "./CommandSayToTrade";
import CommandSelectCharacter from "./CommandSelectCharacter";
import CommandSelectServer from "./CommandSelectServer";
import CommandShout from "./CommandShout";
import CommandSitStand from "./CommandSitStand";
import CommandTell from "./CommandTell";
import CommandUseItem from "./CommandUseItem";
import CommandValidatePosition from "./CommandValidatePosition";


  export default {
    acceptJoinParty: CommandAcceptJoinParty.prototype,
  acceptResurrect: CommandAcceptResurrect.prototype,
  action: CommandAction.prototype,
  attack: CommandAttack.prototype,
  autoShots: CommandAutoShots.prototype,
  cancelBuff: CommandCancelBuff.prototype,
  cancelTarget: CommandCancelTarget.prototype,
  cast: CommandCast.prototype,
  craft: CommandCraft.prototype,
  createCharacter: CommandCreateCharacter.prototype,
  declineJoinParty: CommandDeclineJoinParty.prototype,
  declineResurrect: CommandDeclineResurrect.prototype,
  dropItem: CommandDropItem.prototype,
  dwarvenCraftRecipes: CommandDwarvenCraftRecipes.prototype,
  hit: CommandHit.prototype,
  inventory: CommandInventory.prototype,
  login: CommandLogin.prototype,
  logout: CommandLogout.prototype,
  moveTo: CommandMoveTo.prototype,
  nextTarget: CommandNextTarget.prototype,
  requestBypass: CommandRequestBypass.prototype,
  requestCharacterTemplates: CommandRequestCharacterTemplates.prototype,
  requestDuel: CommandRequestDuel.prototype,
  requestJoinParty: CommandRequestJoinParty.prototype,
  revive: CommandRevive.prototype,
  say: CommandSay.prototype,
  sayToAlly: CommandSayToAlly.prototype,
  sayToClan: CommandSayToClan.prototype,
  sayToParty: CommandSayToParty.prototype,
  sayToTrade: CommandSayToTrade.prototype,
  selectCharacter: CommandSelectCharacter.prototype,
  selectServer: CommandSelectServer.prototype,
  shout: CommandShout.prototype,
  sitStand: CommandSitStand.prototype,
  tell: CommandTell.prototype,
  useItem: CommandUseItem.prototype,
  validatePosition: CommandValidatePosition.prototype,

  };
  