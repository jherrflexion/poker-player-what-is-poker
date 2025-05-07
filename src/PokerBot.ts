import {GameState} from './GameState';

export class PokerBot {
  // Card ranks and suits for evaluating hands
  private readonly RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  private readonly SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
  
  // Set version of our player
  public static readonly VERSION = "What Is Poker v1.0.0";

  public betRequest(gameState: GameState, betCallback: (bet: number) => void): void {
    try {
      const ourPlayer = gameState.ourPlayer();
      const pokerRound = this.calculatePokerRound(gameState.communityCards.length);
      const toCall = gameState.currentBuyIn - ourPlayer.bet;

      const handStrength = this.evaluateHandStrength(ourPlayer.holeCards, gameState.communityCards);

      const playerCount = gameState.players.filter((p: any) => p.status === 'active').length;
      const position = this.calculatePosition(gameState.dealer, gameState.inAction, playerCount);

      const betAmount = this.makeBetDecision(
        handStrength,
        position,
        pokerRound,
        toCall,
        gameState.minimumRaise,
        ourPlayer.stack,
        gameState.smallBlind,
        gameState.pot
      );

      
      betCallback(betAmount);
    } catch (e) {
      console.error('Error in betRequest:', e);
      betCallback(0); // Fold if there's an error
    }
  }

  public showdown(gameState: any): void {

  }
  
  // Format cards for nice logging
  private formatCards(cards: any[]): string {
    return cards.map(card => `${card.rank}${this.getSuitSymbol(card.suit)}`).join(' ');
  }
  
  // Get UTF-8 symbol for card suit
  private getSuitSymbol(suit: string): string {
    switch (suit.toLowerCase()) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return suit.charAt(0).toUpperCase();
    }
  }


  private static activePlayers(gameState: any) {
    return gameState.players.filter((p: any) => p.status === 'active');
  }

// Get reasoning string for our decision
  private getDecisionReasoning(
    handStrength: number,
    position: string,
    pokerRound: string,
    betAmount: number,
    toCall: number
  ): string {
    if (betAmount === 0) return 'Folding weak hand';
    if (betAmount === toCall) return 'Calling with medium strength hand';
    if (betAmount > toCall) {
      if (handStrength > 0.5) return 'Raising with strong hand';
      if (position === 'late') return 'Position-based raise from late position';
      return 'Raising based on pot odds and hand potential';
    }
    return 'Decision based on hand strength and position';
  }
  
  // Describe a poker hand in human-readable form
  private describeHand(holeCards: any[], communityCards: any[]): string {
    const allCards = [...holeCards, ...communityCards];
    
    if (this.hasPair(allCards)) return 'Pair';
    if (this.hasFlushDraw(allCards)) return 'Flush draw';
    if (this.hasStraightDraw(allCards)) return 'Straight draw';
    
    return 'High card';
  }
  
  // Determine the current round of poker
  private calculatePokerRound(communityCardCount: number): string {
    if (communityCardCount === 0) return 'pre-flop';
    if (communityCardCount === 3) return 'flop';
    if (communityCardCount === 4) return 'turn';
    if (communityCardCount === 5) return 'river';
    return 'unknown';
  }
  
  // Calculate our position (early, middle, late)
  private calculatePosition(dealerPosition: number, ourPosition: number, playerCount: number): string {
    // Calculate positions relative to dealer
    const positionFromDealer = (ourPosition - dealerPosition - 1 + playerCount) % playerCount;
    
    const earlyPositionThreshold = Math.floor(playerCount / 3);
    const middlePositionThreshold = Math.floor(2 * playerCount / 3);
    
    if (positionFromDealer < earlyPositionThreshold) return 'early';
    if (positionFromDealer < middlePositionThreshold) return 'middle';
    return 'late';
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
    const suitCounts: {[key: string]: number} = {};
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
      if (rankValues[i] === rankValues[i-1] + 1) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else if (rankValues[i] !== rankValues[i-1]) {
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
  private makeBetDecision(
    handStrength: number,
    position: string,
    pokerRound: string,
    toCall: number,
    minimumRaise: number,
    ourStack: number,
    smallBlind: number,
    pot: number
  ): number {
    // Fold with weak hands
    if (handStrength < 0.15) {
      return 0;
    }
    
    // More aggressive play with strong hands
    if (handStrength > 0.5) {
      // With strong hand, raise
      const raiseAmount = toCall + minimumRaise * 2;
      
      // Make sure we don't bet more than we have
      return Math.min(raiseAmount, ourStack);
    }
    
    // Position based play
    const positionFactor = position === 'late' ? 1.2 : 
                          position === 'middle' ? 1.0 : 0.8;
    
    // Round based play
    const roundFactor = pokerRound === 'pre-flop' ? 0.8 :
                       pokerRound === 'flop' ? 1.0 :
                       pokerRound === 'turn' ? 1.2 : 1.5;
    
    // Calculating bet based on pot size and our hand strength
    const betRatio = handStrength * positionFactor * roundFactor;
    
    // Calculate potential bet
    const potBet = Math.round(pot * betRatio);
    
    // For small pots, ensure minimum raise if we want to call
    if (handStrength > 0.3) {
      const raise = toCall + Math.max(minimumRaise, potBet);
      return Math.min(raise, ourStack);
    }
    
    // Call with medium strength hands if the cost is reasonable
    if (handStrength > 0.2 && toCall <= smallBlind * 4) {
      return toCall;
    }
    
    // Fold with weak hands or if the cost to call is too high
    return 0;
  }
}

export default PokerBot;

