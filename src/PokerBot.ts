import { GameState } from './GameState';
import { HandEvaluator } from './HandEvaluator';
import { PlayerTracker } from './PlayerTracker';

export class PokerBot {
  public static readonly VERSION = "Opponent Tracker v1.0";
  private playerTracker: PlayerTracker = PlayerTracker.getInstance();

  public betRequest(gameState: GameState, betCallback: (bet: number) => void): void {
    try {
      // Process the game state to track player actions
      this.playerTracker.processGameState(gameState);

      this.playerTracker.logPlayerStats();
      
      betCallback(this.makeBetDecision(gameState));
    } catch (e) {
      console.error('Error in betRequest:', e);
      betCallback(0); // Fold if there's an error
    }
  }

  // noinspection JSUnusedLocalSymbols
  public showdown(gameState: GameState): void {
    // Log final player statistics at showdown
    this.playerTracker.logPlayerStats();
  }

  public static betAmounts(gameState: GameState, handStrength: number, opponentAggression: number): any {
    // Adjust bet sizing based on hand strength, position, round, and opponent aggression
    const betRatio = handStrength * PokerBot.positionFactor(gameState) * PokerBot.roundFactor(gameState);
    
    // Against aggressive opponents, we can bluff more with weaker hands
    // and value bet more with stronger hands
    const adjustedBetRatio = opponentAggression > 0.7 
      ? (handStrength < 0.3 ? betRatio * 1.3 : betRatio * 1.2) // More bluffs against aggressive players
      : (opponentAggression < 0.3 
          ? (handStrength > 0.7 ? betRatio * 1.3 : betRatio * 0.8) // Value bet more, bluff less against passive players
          : betRatio); // Neutral adjustment for neutral players
    
    const potBet = Math.round(gameState.pot * adjustedBetRatio);

    return {
      fold: 0,
      call: gameState.toCall(),
      smallRaise: gameState.toCall() + Math.max(gameState.minimumRaise, potBet),
      bigRaise: gameState.toCall() + gameState.minimumRaise * 2
    }
  }

  private makeBetDecision(gameState: GameState): number {
    const handStrength = HandEvaluator.evaluateHandStrength(
      gameState.ourPlayer().holeCards,
      gameState.communityCards
    );
    
    // Calculate average aggressiveness of active opponents
    const opponents = gameState.activePlayers().filter(p => p.id !== gameState.ourPlayer().id);
    let avgOpponentAggression = 0.5; // Default value
    
    if (opponents.length > 0) {
      const totalAggression = opponents.reduce((sum, player) => {
        return sum + this.playerTracker.getAggressivenessScore(player.id);
      }, 0);
      avgOpponentAggression = totalAggression / opponents.length;
    }
    
    console.log(`Hand strength: ${handStrength.toFixed(2)}, Average opponent aggressiveness: ${avgOpponentAggression.toFixed(2)}`);
    
    const betAmounts = PokerBot.betAmounts(gameState, handStrength, avgOpponentAggression);

    // Adjust decision thresholds based on opponent aggressiveness
    if (avgOpponentAggression > 0.7) {
      // Against aggressive opponents
      if (handStrength > 0.6) {
        return betAmounts.bigRaise; // Value bet strong hands
      } else if (handStrength > 0.4) {
        return betAmounts.smallRaise;
      } else if (handStrength > 0.15 && gameState.toCall() <= gameState.smallBlind * 5) {
        return betAmounts.call; // Call with slightly weaker hands
      } else if (handStrength < 0.15 && Math.random() < 0.2 && gameState.pokerRound() !== 'pre-flop') {
        return betAmounts.smallRaise; // Occasionally bluff with weak hands
      } else {
        return betAmounts.fold;
      }
    } else if (avgOpponentAggression < 0.3) {
      // Against passive opponents
      if (handStrength > 0.45) {
        return betAmounts.bigRaise; // Be more aggressive with good hands
      } else if (handStrength > 0.25) {
        return betAmounts.smallRaise; // Raise more frequently
      } else if (handStrength > 0.15 && gameState.toCall() <= gameState.smallBlind * 3) {
        return betAmounts.call;
      } else {
        return betAmounts.fold;
      }
    } else {
      // Against neutral opponents, use the default strategy
      if (handStrength > 0.5) {
        return betAmounts.bigRaise;
      } else if (handStrength > 0.3) {
        return betAmounts.smallRaise;
      } else if (handStrength > 0.2 && gameState.toCall() <= gameState.smallBlind * 4) {
        return betAmounts.call;
      } else {
        return betAmounts.fold;
      }
    }
  }

  private static roundFactor(gameState: GameState): number {
    return gameState.pokerRound() === 'pre-flop' ? 0.8 : gameState.pokerRound() === 'flop' ? 1.0 : gameState.pokerRound() === 'turn' ? 1.2 : 1.5;
  }

  private static positionFactor(gameState: GameState): number {
    return gameState.position() === 'late' ? 1.2 : gameState.position() === 'middle' ? 1.0 : 0.8;
  }
}

export default PokerBot;
