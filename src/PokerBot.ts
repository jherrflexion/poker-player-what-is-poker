import {GameState} from './GameState';

export class PokerBot {
  // Card ranks and suits for evaluating hands
  private readonly RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  private readonly SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

  // Set version of our player
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

  // Evaluate hand strength on a scale of 0-1
  private evaluateHandStrength(holeCards: any[], communityCards: any[]): number {
    // Pre-flop hand evaluation
    if (communityCards.length === 0) {
      return this.evaluatePreFlopHand(holeCards);
    }

    // Post-flop hand evaluation
    const allCards = [...holeCards, ...communityCards];

    // Check for pairs or better
    if (this.hasPair(allCards)) return 0.5;
    if (this.hasFlushDraw(allCards)) return 0.4;
    if (this.hasStraightDraw(allCards)) return 0.3;

    // High card value
    const highCard = this.getHighCardValue(holeCards);
    return 0.1 + (highCard / 15);
  }

  // Evaluate pre-flop hand strength
  private evaluatePreFlopHand(holeCards: any[]): number {
    const ranks = holeCards.map(card => card.rank);
    const suits = holeCards.map(card => card.suit);

    // Check for pocket pairs
    if (ranks[0] === ranks[1]) {
      const rankIndex = this.RANKS.indexOf(ranks[0]);
      // Higher pairs are stronger
      return 0.5 + (rankIndex / 30);
    }

    // Check for suited cards
    const isSuited = suits[0] === suits[1];

    // Convert card ranks to values
    const rankValues = ranks.map(rank => this.RANKS.indexOf(rank));
    const highCard = Math.max(...rankValues);
    const lowCard = Math.min(...rankValues);

    // Check for connected cards
    const isConnected = Math.abs(rankValues[0] - rankValues[1]) <= 2;

    // Evaluate hand strength
    if (highCard >= 10) { // High cards (10, J, Q, K, A)
      if (lowCard >= 10) return 0.45; // Both high cards
      if (isSuited) return 0.35; // Suited high card
      return 0.3; // Unsuited high card
    }

    if (isSuited && isConnected) return 0.25; // Suited connectors
    if (isSuited) return 0.2; // Suited
    if (isConnected) return 0.15; // Connected

    // Low value hand
    return 0.1;
  }

  // Check if we have at least a pair
  private hasPair(cards: any[]): boolean {
    const ranks = cards.map(card => card.rank);
    for (let i = 0; i < ranks.length; i++) {
      for (let j = i + 1; j < ranks.length; j++) {
        if (ranks[i] === ranks[j]) return true;
      }
    }
    return false;
  }

  // Check if we have a flush draw
  private hasFlushDraw(cards: any[]): boolean {
    const suitCounts: { [key: string]: number } = {};
    for (const card of cards) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
    return Object.values(suitCounts).some((count: number) => count >= 4);
  }

  // Check if we have a straight draw
  private hasStraightDraw(cards: any[]): boolean {
    const rankValues = cards.map(card => this.RANKS.indexOf(card.rank)).sort((a, b) => a - b);
    let consecutiveCount = 1;
    let maxConsecutive = 1;

    for (let i = 1; i < rankValues.length; i++) {
      if (rankValues[i] === rankValues[i - 1] + 1) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else if (rankValues[i] !== rankValues[i - 1]) {
        consecutiveCount = 1;
      }
    }

    return maxConsecutive >= 4;
  }

  // Get the value of the highest card
  private getHighCardValue(cards: any[]): number {
    return Math.max(...cards.map(card => this.RANKS.indexOf(card.rank)));
  }

  // Make betting decision based on various factors
  private makeBetDecision(gameState: GameState): number {
    let handStrength = this.evaluateHandStrength(gameState.ourPlayer().holeCards, gameState.communityCards);

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

  private static roundFactor(gameState: GameState) {
    return gameState.pokerRound() === 'pre-flop' ? 0.8 : gameState.pokerRound() === 'flop' ? 1.0 : gameState.pokerRound() === 'turn' ? 1.2 : 1.5;
  }

  private static positionFactor(gameState: GameState) {
    return gameState.position() === 'late' ? 1.2 : gameState.position() === 'middle' ? 1.0 : 0.8;
  }
}

export default PokerBot;
