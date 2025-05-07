import { GameState } from './GameState';
import { HandEvaluator } from './HandEvaluator';

export class PokerBot {
  public static readonly VERSION = "Refactoring frenzy v1.0";

  public betRequest(gameState: GameState, betCallback: (bet: number) => void): void {
    try {
      betCallback(this.makeBetDecision(gameState));
    } catch (e) {
      console.error('Error in betRequest:', e);
      betCallback(0); // Fold if there's an error
    }
  }

  public showdown(gameState: GameState): void {
    // No changes made to this method
  }

  private makeBetDecision(gameState: GameState): number {
    const handStrength = HandEvaluator.evaluateHandStrength(
      gameState.ourPlayer().holeCards,
      gameState.communityCards
    );

    if (handStrength < 0.15) {
      return 0; // Fold with weak hands
    }

    if (handStrength > 0.5) {
      return gameState.toCall() + gameState.minimumRaise * 2;
    }

    const betRatio = handStrength * PokerBot.positionFactor(gameState) * PokerBot.roundFactor(gameState);
    const potBet = Math.round(gameState.pot * betRatio);

    if (handStrength > 0.3) {
      return gameState.toCall() + Math.max(gameState.minimumRaise, potBet);
    }

    if (handStrength > 0.2 && gameState.toCall() <= gameState.smallBlind * 4) {
      return gameState.toCall();
    }

    return 0; // Fold with weak hands or high cost
  }

  private static roundFactor(gameState: GameState): number {
    return gameState.pokerRound() === 'pre-flop' ? 0.8 : gameState.pokerRound() === 'flop' ? 1.0 : gameState.pokerRound() === 'turn' ? 1.2 : 1.5;
  }

  private static positionFactor(gameState: GameState): number {
    return gameState.position() === 'late' ? 1.2 : gameState.position() === 'middle' ? 1.0 : 0.8;
  }
}

export default PokerBot;
