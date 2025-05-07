import { CardProps } from './Card';

export class HandEvaluator {
  private static readonly RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  public static evaluateHandStrength(holeCards: CardProps[], communityCards: CardProps[]): number {
    if (communityCards.length === 0) {
      return this.evaluatePreFlopHand(holeCards);
    }

    const allCards = [...holeCards, ...communityCards];

    if (this.hasPair(allCards)) return 0.5;
    if (this.hasFlushDraw(allCards)) return 0.4;
    if (this.hasStraightDraw(allCards)) return 0.3;

    const highCard = this.getHighCardValue(holeCards);
    return 0.1 + (highCard / 15);
  }

  private static evaluatePreFlopHand(holeCards: CardProps[]): number {
    const ranks = holeCards.map(card => card.rank);
    const suits = holeCards.map(card => card.suit);

    if (ranks[0] === ranks[1]) {
      const rankIndex = this.RANKS.indexOf(ranks[0]);
      return 0.5 + (rankIndex / 30);
    }

    const isSuited = suits[0] === suits[1];
    const rankValues = ranks.map(rank => this.RANKS.indexOf(rank));
    const highCard = Math.max(...rankValues);
    const lowCard = Math.min(...rankValues);
    const isConnected = Math.abs(rankValues[0] - rankValues[1]) <= 2;

    if (highCard >= 10) {
      if (lowCard >= 10) return 0.45;
      if (isSuited) return 0.35;
      return 0.3;
    }

    if (isSuited && isConnected) return 0.25;
    if (isSuited) return 0.2;
    if (isConnected) return 0.15;

    return 0.1;
  }

  private static hasPair(cards: CardProps[]): boolean {
    const ranks = cards.map(card => card.rank);
    return ranks.some((rank, i) => ranks.indexOf(rank) !== i);
  }

  private static hasFlushDraw(cards: CardProps[]): boolean {
    const suitCounts: { [key: string]: number } = {};
    for (const card of cards) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
    return Object.values(suitCounts).some(count => count >= 4);
  }

  private static hasStraightDraw(cards: CardProps[]): boolean {
    const rankValues = cards.map(card => this.RANKS.indexOf(card.rank)).sort((a, b) => a - b);
    let consecutiveCount = 1;

    for (let i = 1; i < rankValues.length; i++) {
      if (rankValues[i] === rankValues[i - 1] + 1) {
        consecutiveCount++;
        if (consecutiveCount >= 4) return true;
      } else if (rankValues[i] !== rankValues[i - 1]) {
        consecutiveCount = 1;
      }
    }

    return false;
  }

  private static getHighCardValue(cards: CardProps[]): number {
    return Math.max(...cards.map(card => this.RANKS.indexOf(card.rank)));
  }
}
