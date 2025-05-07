import {Player, PlayerProps} from "./Player";
import {CardProps} from "./Card";

export interface GameStateProps {
  tournament_id: string; // Id of the current tournament
  game_id: string; // Id of the current sit'n'go game
  round: number; // Index of the current round
  bet_index: number; // Index of the betting opportunity within a round
  small_blind: number; // Small blind in the current round
  current_buy_in: number; // Largest current bet from any one player
  pot: number; // Size of the pot
  minimum_raise: number; // Minimum raise amount
  dealer: number; // Index of the player on the dealer button
  orbits: number; // Number of orbits completed
  in_action: number; // Index of the player in action
  players: PlayerProps[]; // Array of players
  community_cards: CardProps[]; // Array of community cards
}

export class GameState {
  tournamentId: string;
  gameId: string;
  round: number;
  betIndex: number;
  smallBlind: number;
  currentBuyIn: number;
  pot: number;
  minimumRaise: number;
  dealer: number;
  orbits: number;
  inAction: number;
  players: PlayerProps[];
  communityCards: CardProps[];

  constructor(props: GameStateProps) {
    this.tournamentId = props.tournament_id;
    this.gameId = props.game_id;
    this.round = props.round;
    this.betIndex = props.bet_index;
    this.smallBlind = props.small_blind;
    this.currentBuyIn = props.current_buy_in;
    this.pot = props.pot;
    this.minimumRaise = props.minimum_raise;
    this.dealer = props.dealer;
    this.orbits = props.orbits;
    this.inAction = props.in_action;
    this.players = props.players.map(player => new Player(player));
    this.communityCards = props.community_cards;
  }

  ourPlayer(): Player {
        return this.players[this.inAction];
    }
}
