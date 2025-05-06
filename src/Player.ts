export class Player {
  // Card ranks and suits for evaluating hands
  private readonly RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  private readonly SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
  
  // Set version of our player
  public static readonly VERSION = "What Is Poker v1.0.0";

  // Tracking data across game rounds
  private gameHistory: {
    gameId?: string;
    roundIndex: number;
    opponentProfiles: Map<string, OpponentProfile>;
    roundHistory: RoundData[];
  } = {
    roundIndex: 0,
    opponentProfiles: new Map(),
    roundHistory: []
  };

  public betRequest(gameState: any, betCallback: (bet: number) => void): void {
    try {
      // Track the game ID for logging
      if (!this.gameHistory.gameId && gameState.game_id) {
        this.gameHistory.gameId = gameState.game_id;
        this.logGameStart(gameState);
      }
      
      // Create round data object to collect info during this round
      const roundData: RoundData = {
        roundId: this.gameHistory.roundIndex++,
        gameId: gameState.game_id,
        timestamp: new Date().toISOString(),
        roundName: '',
        potSize: gameState.pot,
        communityCards: [],
        playerActions: [],
        ourDecision: {
          handStrength: 0,
          position: '',
          betAmount: 0,
          reasoning: '',
        }
      };

      console.log(`[Game ${gameState.game_id}] Round ${roundData.roundId} starting`);
      
      // Find our player
      const ourPlayer = gameState.players[gameState.in_action];
      const ourPlayerId = ourPlayer.id || ourPlayer.name;
      
      // Log active players and their stacks
      this.logActivePlayers(gameState, roundData);
      
      // Get our hole cards
      const holeCards = ourPlayer.hole_cards || [];
      if (!holeCards.length) {
        console.log(`[Game ${gameState.game_id}] No hole cards found, folding`);
        roundData.ourDecision.reasoning = 'No hole cards available';
        roundData.ourDecision.betAmount = 0;
        this.logRoundData(roundData);
        betCallback(0);
        return;
      }
      
      // Log our hole cards
      console.log(`[Game ${gameState.game_id}] Our hole cards: ${this.formatCards(holeCards)}`);
      
      // Get community cards
      const communityCards = gameState.community_cards || [];
      roundData.communityCards = [...communityCards];
      
      // Calculate current round
      const pokerRound = this.calculatePokerRound(communityCards.length);
      roundData.roundName = pokerRound;
      
      // Log community cards and round
      if (communityCards.length > 0) {
        console.log(`[Game ${gameState.game_id}] Community cards (${pokerRound}): ${this.formatCards(communityCards)}`);
      } else {
        console.log(`[Game ${gameState.game_id}] Pre-flop round`);
      }
      
      // Betting amounts
      const currentBuyIn = gameState.current_buy_in;
      const minimumRaise = gameState.minimum_raise;
      const ourCurrentBet = ourPlayer.bet;
      const toCall = currentBuyIn - ourCurrentBet;
      const smallBlind = gameState.small_blind;
      
      // Log betting state
      console.log(`[Game ${gameState.game_id}] Current buy-in: ${currentBuyIn}, Minimum raise: ${minimumRaise}, Our current bet: ${ourCurrentBet}, To call: ${toCall}`);
      
      // Our stack 
      const ourStack = ourPlayer.stack;
      
      // Hand strength evaluation
      const handStrength = this.evaluateHandStrength(holeCards, communityCards);
      roundData.ourDecision.handStrength = handStrength;
      
      // Position evaluation (being in late position is better)
      const playerCount = gameState.players.filter((p: any) => p.status === 'active').length;
      const position = this.calculatePosition(gameState.dealer, gameState.in_action, playerCount);
      roundData.ourDecision.position = position;
      
      // Track previous actions in this round
      this.trackPlayerActions(gameState, roundData);
      
      // Decision making based on different factors
      const betAmount = this.makeBetDecision(
        handStrength,
        position,
        pokerRound,
        toCall,
        minimumRaise,
        ourStack,
        smallBlind,
        gameState.pot
      );
      
      // Log our decision with detailed reasoning
      let decisionReasoning = this.getDecisionReasoning(
        handStrength, 
        position, 
        pokerRound, 
        betAmount, 
        toCall
      );
      
      roundData.ourDecision.betAmount = betAmount;
      roundData.ourDecision.reasoning = decisionReasoning;
      
      console.log(`[Game ${gameState.game_id}] Betting ${betAmount} with hand strength ${handStrength} (${decisionReasoning})`);
      
      // Save round data to history
      this.logRoundData(roundData);
      
      betCallback(betAmount);
    } catch (e) {
      console.error('Error in betRequest:', e);
      betCallback(0); // Fold if there's an error
    }
  }

  public showdown(gameState: any): void {
    try {
      console.log(`[Game ${gameState.game_id}] Showdown reached`);
      
      // Find our player
      const ourPlayerId = gameState.players.find((p: any) => 
        p.name === Player.VERSION || p.id === gameState.in_action
      )?.id;
      
      // Create showdown data object
      const showdownData = {
        gameId: gameState.game_id,
        timestamp: new Date().toISOString(),
        pot: gameState.pot,
        winners: [] as any[],
        allHands: [] as any[],
        ourResult: {
          won: false,
          handRank: '',
          amountWon: 0
        }
      };
      
      // Log player hands
      console.log('[Showdown] Player hands:');
      
      // Track each player's hand and result
      for (const player of gameState.players) {
        if (player.status !== 'active' || !player.hole_cards) continue;
        
        const playerId = player.id || player.name;
        const isUs = playerId === ourPlayerId;
        const playerProfile = this.getOrCreatePlayerProfile(playerId, player.name);
        
        // Format player's hand
        const handString = this.formatCards(player.hole_cards);
        
        // Get a hand rank if available in the game state (depends on the poker server implementation)
        const handRank = player.hand_rank || this.describeHand(player.hole_cards, gameState.community_cards || []);
        
        // Track if they won
        const isWinner = gameState.winners && gameState.winners.some((w: any) => w.id === playerId || w.name === player.name);
        const amountWon = isWinner ? (gameState.pot / gameState.winners.length) : 0;
        
        // Update player profile
        if (isWinner) {
          playerProfile.wins++;
          playerProfile.totalWinnings += amountWon;
        } else {
          playerProfile.losses++;
        }
        
        // Log hand and result
        console.log(`[Showdown] ${isUs ? 'OUR HAND' : player.name}: ${handString} - ${handRank} ${isWinner ? `(WON: ${amountWon})` : ''}`);
        
        // Add to showdown data
        const playerData = {
          id: playerId,
          name: player.name,
          hand: [...player.hole_cards],
          handRank,
          isWinner,
          amountWon
        };
        
        if (isWinner) {
          showdownData.winners.push(playerData);
        }
        
        if (isUs) {
          showdownData.ourResult = {
            won: isWinner,
            handRank,
            amountWon
          };
        }
        
        showdownData.allHands.push(playerData);
      }
      
      // Log overall game stats
      this.logGameStats(gameState);
      
      // Save showdown data
      console.log(`[Game ${gameState.game_id}] Showdown data: ${JSON.stringify(showdownData)}`);
    } catch (e) {
      console.error('Error in showdown:', e);
    }
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
  
  // Log game start information
  private logGameStart(gameState: any): void {
    console.log(`==============================================`);
    console.log(`[Game ${gameState.game_id}] New game started with ${gameState.players.length} players`);
    console.log(`==============================================`);
    
    // Log initial player information
    for (const player of gameState.players) {
      const playerId = player.id || player.name;
      this.getOrCreatePlayerProfile(playerId, player.name);
      console.log(`[Game ${gameState.game_id}] Player: ${player.name}, Stack: ${player.stack}`);
    }
  }
  
  // Log active players in current round
  private logActivePlayers(gameState: any, roundData: RoundData): void {
    const activePlayers = gameState.players.filter((p: any) => p.status === 'active');
    
    console.log(`[Game ${gameState.game_id}] Active players: ${activePlayers.length}`);
    for (const player of activePlayers) {
      const playerId = player.id || player.name;
      const playerProfile = this.getOrCreatePlayerProfile(playerId, player.name);
      
      // Track bet amount in current round
      playerProfile.currentBet = player.bet || 0;
      
      console.log(`[Game ${gameState.game_id}] Player: ${player.name}, Stack: ${player.stack}, Bet: ${player.bet}`);
    }
  }
  
  // Get or create player profile for tracking
  private getOrCreatePlayerProfile(playerId: string, playerName: string): OpponentProfile {
    if (!this.gameHistory.opponentProfiles.has(playerId)) {
      this.gameHistory.opponentProfiles.set(playerId, {
        id: playerId,
        name: playerName,
        wins: 0,
        losses: 0,
        totalWinnings: 0,
        currentBet: 0,
        actionPattern: {
          preFlopFoldRate: 0,
          preFlopRaiseRate: 0,
          aggressionFactor: 0,
          totalActions: 0
        },
        actionHistory: []
      });
    }
    
    return this.gameHistory.opponentProfiles.get(playerId)!;
  }
  
  // Track all player actions in the current round
  private trackPlayerActions(gameState: any, roundData: RoundData): void {
    if (!gameState.betting_phase) return;
    
    const currentPhase = gameState.betting_phase;
    
    console.log(`[Game ${gameState.game_id}] Betting phase: ${currentPhase}`);
    
    // Check player actions based on bet changes and previous rounds
    for (const player of gameState.players) {
      if (player.status !== 'active') continue;
      
      const playerId = player.id || player.name;
      const playerProfile = this.getOrCreatePlayerProfile(playerId, player.name);
      
      // Try to determine action (very basic - would need more data from the server)
      let actionType = 'unknown';
      const isDealer = gameState.dealer === player.id;
      const isSmallBlind = (gameState.dealer + 1) % gameState.players.length === player.id;
      const isBigBlind = (gameState.dealer + 2) % gameState.players.length === player.id;
      
      if (isSmallBlind && player.bet === gameState.small_blind) {
        actionType = 'small_blind';
      } else if (isBigBlind && player.bet === gameState.small_blind * 2) {
        actionType = 'big_blind';
      } else if (player.bet === 0) {
        actionType = 'fold';
      } else if (player.bet === gameState.current_buy_in) {
        actionType = 'call';
      } else if (player.bet > gameState.current_buy_in) {
        actionType = 'raise';
      }
      
      // Add action to round data
      if (actionType !== 'unknown') {
        const action = {
          playerId,
          playerName: player.name,
          action: actionType,
          amount: player.bet,
          round: roundData.roundName
        };
        
        // Add to player's history
        playerProfile.actionHistory.push(action);
        
        // Add to round data
        roundData.playerActions.push(action);
        
        // Update action patterns
        this.updatePlayerActionPattern(playerProfile, action);
        
        console.log(`[Game ${gameState.game_id}] Player ${player.name} action: ${actionType} (${player.bet})`);
      }
    }
  }
  
  // Update player action patterns for analysis
  private updatePlayerActionPattern(profile: OpponentProfile, action: PlayerAction): void {
    // Increment total actions
    profile.actionPattern.totalActions++;
    
    // Update pre-flop statistics
    if (action.round === 'pre-flop') {
      if (action.action === 'fold') {
        profile.actionPattern.preFlopFoldRate = 
          (profile.actionPattern.preFlopFoldRate * (profile.actionPattern.totalActions - 1) + 1) / 
          profile.actionPattern.totalActions;
      }
      
      if (action.action === 'raise') {
        profile.actionPattern.preFlopRaiseRate = 
          (profile.actionPattern.preFlopRaiseRate * (profile.actionPattern.totalActions - 1) + 1) / 
          profile.actionPattern.totalActions;
      }
    }
    
    // Update aggression factor (raises and bets vs calls and checks)
    const aggressiveActions = profile.actionHistory.filter(a => 
      a.action === 'raise' || a.action === 'bet'
    ).length;
    
    const passiveActions = profile.actionHistory.filter(a => 
      a.action === 'call' || a.action === 'check'
    ).length;
    
    profile.actionPattern.aggressionFactor = passiveActions > 0 ? 
      aggressiveActions / passiveActions : 
      aggressiveActions;
  }
  
  // Log round data
  private logRoundData(roundData: RoundData): void {
    this.gameHistory.roundHistory.push(roundData);
    
    // Log the full round data - in a real situation, you might want to send this to a database or file
    console.log(`[Game ${roundData.gameId}] Round ${roundData.roundId} (${roundData.roundName}) complete`);
    console.log(`[Game ${roundData.gameId}] Round data: ${JSON.stringify({
      roundId: roundData.roundId,
      roundName: roundData.roundName,
      potSize: roundData.potSize,
      communityCards: this.formatCards(roundData.communityCards),
      actions: roundData.playerActions.length,
      decision: roundData.ourDecision
    })}`);
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
  
  // Log overall game stats
  private logGameStats(gameState: any): void {
    console.log(`==============================================`);
    console.log(`[Game ${gameState.game_id}] Game stats`);
    
    // Log opponent profiles
    console.log('Opponent profiles:');
    for (const [id, profile] of this.gameHistory.opponentProfiles.entries()) {
      console.log(`Player: ${profile.name}
  Wins: ${profile.wins}
  Losses: ${profile.losses}
  Total winnings: ${profile.totalWinnings}
  Pre-flop fold rate: ${(profile.actionPattern.preFlopFoldRate * 100).toFixed(2)}%
  Pre-flop raise rate: ${(profile.actionPattern.preFlopRaiseRate * 100).toFixed(2)}%
  Aggression factor: ${profile.actionPattern.aggressionFactor.toFixed(2)}`);
    }
    
    console.log(`==============================================`);
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
};

// Type definitions for our logging system
interface PlayerAction {
  playerId: string;
  playerName: string;
  action: string;
  amount: number;
  round: string;
}

interface RoundData {
  roundId: number;
  gameId: string;
  timestamp: string;
  roundName: string;
  potSize: number;
  communityCards: any[];
  playerActions: PlayerAction[];
  ourDecision: {
    handStrength: number;
    position: string;
    betAmount: number;
    reasoning: string;
  }
}

interface OpponentProfile {
  id: string;
  name: string;
  wins: number;
  losses: number;
  totalWinnings: number;
  currentBet: number;
  actionPattern: {
    preFlopFoldRate: number;
    preFlopRaiseRate: number;
    aggressionFactor: number;
    totalActions: number;
  };
  actionHistory: PlayerAction[];
}

export default Player;
