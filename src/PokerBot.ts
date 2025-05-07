import { GameState } from './GameState';
import { HandEvaluator } from './HandEvaluator';
import { PlayerTracker } from './PlayerTracker';

export class PokerBot {
  public static readonly VERSION = "Aggressive Heads-Up v1.2";
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

  public static betAmounts(gameState: GameState, handStrength: number, opponentAggression: number, isHeadsUp: boolean): any {
    // Adjust bet sizing based on hand strength, position, round, and opponent aggression
    let betRatio = handStrength * PokerBot.positionFactor(gameState) * PokerBot.roundFactor(gameState);
    
    // Adjust bet sizing based on whether we're heads-up and opponent aggression
    if (isHeadsUp && opponentAggression > 0.7) {
      // In heads-up against aggressive player, use more aggressive sizing
      betRatio = betRatio * 1.2;
    } else if (!isHeadsUp && opponentAggression > 0.7) {
      // Multiple aggressive opponents - be more selective with bet sizing
      betRatio = handStrength > 0.6 ? betRatio * 1.2 : betRatio * 0.7;
    }
    
    const potBet = Math.round(gameState.pot * betRatio);

    return {
      fold: 0,
      call: gameState.toCall(),
      smallRaise: gameState.toCall() + Math.max(gameState.minimumRaise, potBet),
      bigRaise: gameState.toCall() + gameState.minimumRaise * 2,
      // Add a larger raise option for heads-up aggressive play
      hugeRaise: gameState.toCall() + gameState.minimumRaise * 3
    }
  }

  private makeBetDecision(gameState: GameState): number {
    const handStrength = HandEvaluator.evaluateHandStrength(
      gameState.ourPlayer().holeCards,
      gameState.communityCards
    );
    
    // Calculate opponent information
    const opponents = gameState.activePlayers().filter(p => p.id !== gameState.ourPlayer().id);
    const isHeadsUp = opponents.length === 1;
    let avgOpponentAggression = 0.5; // Default value
    
    if (opponents.length > 0) {
      const totalAggression = opponents.reduce((sum, player) => {
        return sum + this.playerTracker.getAggressivenessScore(player.id);
      }, 0);
      avgOpponentAggression = totalAggression / opponents.length;
    }
    
    console.log(`Hand strength: ${handStrength.toFixed(2)}, Average opponent aggressiveness: ${avgOpponentAggression.toFixed(2)}`);
    console.log(`Active opponents: ${opponents.length}, Heads-up: ${isHeadsUp}`);
    
    const betAmounts = PokerBot.betAmounts(gameState, handStrength, avgOpponentAggression, isHeadsUp);

    // Multiple aggressive opponents - play conservatively and wait for strong hands
    if (!isHeadsUp && avgOpponentAggression > 0.7) {
      console.log("Strategy: Conservative against multiple aggressive opponents");
      
      if (handStrength > 0.7) {
        return betAmounts.bigRaise; // Value bet very strong hands
      } else if (handStrength > 0.5) {
        return betAmounts.smallRaise; // Value bet strong hands
      } else if (handStrength > 0.35 && gameState.toCall() <= gameState.smallBlind * 4) {
        return betAmounts.call; // Call with medium hands if cheap
      } else {
        return betAmounts.fold; // Otherwise fold
      }
    } 
    // Heads-up against aggressive opponent - be more aggressive to counter
    else if (isHeadsUp && avgOpponentAggression > 0.7) {
      console.log("Strategy: AGGRESSIVE heads-up play");
      
      // Use stack size to adjust strategy
      const stackRatio = gameState.ourPlayer().stack / 
                         (opponents[0].stack + gameState.pot);
      const isShortStacked = stackRatio < 0.5;
      
      if (handStrength > 0.6) {
        // With strong hands, be very aggressive
        const raiseRandom = Math.random();
        if (raiseRandom < 0.6) {
          return betAmounts.bigRaise;
        } else if (raiseRandom < 0.8) {
          return betAmounts.hugeRaise;
        } else {
          // Occasionally slow-play to trap
          return betAmounts.call;
        }
      } else if (handStrength > 0.4) {
        // With medium-strong hands, be aggressive
        return Math.random() < 0.7 ? betAmounts.smallRaise : betAmounts.call;
      } else if (handStrength > 0.3) {
        // With medium hands, mix calls with raises
        if (gameState.pokerRound() === 'river') {
          // Value bet more on the river
          return Math.random() < 0.6 ? betAmounts.smallRaise : betAmounts.call;
        }
        return Math.random() < 0.4 ? betAmounts.smallRaise : betAmounts.call;
      } else if (handStrength > 0.2 && gameState.toCall() <= gameState.smallBlind * 6) {
        // With medium-weak hands, call if cheap
        return betAmounts.call;
      } else if (handStrength < 0.2) {
        // With weak hands, mix in some bluffs
        if (gameState.pokerRound() === 'river' && Math.random() < 0.25) {
          return betAmounts.smallRaise; // Bluff on river
        } else if ((gameState.pokerRound() === 'turn' || gameState.pokerRound() === 'flop') && Math.random() < 0.15) {
          return betAmounts.smallRaise; // Semi-bluff on earlier streets
        } else if (gameState.toCall() <= gameState.smallBlind * 2) {
          return betAmounts.call; // Call very cheap bets with any hand
        } else {
          return betAmounts.fold;
        }
      } else {
        return betAmounts.fold;
      }
    }
    // Non-aggressive or mixed opponents - use default strategy with slight adjustments
    else {
      console.log("Strategy: Default with adjustments");
      
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
