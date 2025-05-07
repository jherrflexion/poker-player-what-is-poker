import { Player } from './Player';
import { GameState } from './GameState';

export interface PlayerAction {
  gameId: string;
  round: number;
  betIndex: number;
  action: 'fold' | 'call' | 'raise';
  betAmount: number;
}

export interface PlayerStats {
  id: number;
  name: string;
  actions: PlayerAction[];
  aggressivenessScore: number;
}

export class PlayerTracker {
  private static instance: PlayerTracker;
  private playerStats: Map<number, PlayerStats> = new Map();
  private lastGameState?: {gameId: string, round: number, betIndex: number, playerBets: Map<number, number>};

  private constructor() {}

  public static getInstance(): PlayerTracker {
    if (!PlayerTracker.instance) {
      PlayerTracker.instance = new PlayerTracker();
    }
    return PlayerTracker.instance;
  }

  public processGameState(gameState: GameState): void {
    // Initialize tracking for new players
    gameState.players.forEach(player => {
      if (!this.playerStats.has(player.id)) {
        this.playerStats.set(player.id, {
          id: player.id,
          name: player.name,
          actions: [],
          aggressivenessScore: 0.5 // Default neutral score
        });
      }
    });

    // If this is a new hand or we don't have previous state, just record current bets
    if (!this.lastGameState || 
        this.lastGameState.gameId !== gameState.gameId || 
        this.lastGameState.round !== gameState.round ||
        this.lastGameState.betIndex >= gameState.betIndex) {
      
      this.updateLastGameState(gameState);
      return;
    }

    // Identify actions by comparing with previous state
    this.identifyPlayerActions(gameState);
    
    // Update for next comparison
    this.updateLastGameState(gameState);
  }

  private updateLastGameState(gameState: GameState): void {
    const playerBets = new Map<number, number>();
    gameState.players.forEach(player => {
      playerBets.set(player.id, player.bet);
    });

    this.lastGameState = {
      gameId: gameState.gameId,
      round: gameState.round,
      betIndex: gameState.betIndex,
      playerBets
    };
  }

  private identifyPlayerActions(gameState: GameState): void {
    if (!this.lastGameState) return;

    gameState.players.forEach(player => {
      const previousBet = this.lastGameState!.playerBets.get(player.id) || 0;
      
      // Skip our own player and players who were already out
      if (player.id === gameState.ourPlayer().id || 
          player.status === 'out') return;
      
      // Detect action
      if (player.status === 'folded' && previousBet >= 0) {
        this.trackAction(player.id, player.name, gameState, 'fold', player.bet);
      } else if (player.bet > previousBet) {
        // Determine if it's a call or raise
        const otherPlayerMaxBet = Math.max(...Array.from(this.lastGameState!.playerBets.values()));
        
        if (player.bet > otherPlayerMaxBet) {
          this.trackAction(player.id, player.name, gameState, 'raise', player.bet);
        } else {
          this.trackAction(player.id, player.name, gameState, 'call', player.bet);
        }
      }
    });
  }

  private trackAction(
    playerId: number, 
    playerName: string, 
    gameState: GameState, 
    action: 'fold' | 'call' | 'raise', 
    betAmount: number
  ): void {
    const stats = this.playerStats.get(playerId)!;
    
    stats.actions.push({
      gameId: gameState.gameId,
      round: gameState.round,
      betIndex: gameState.betIndex,
      action,
      betAmount
    });
    
    this.updateAggressivenessScore(playerId);
    
    console.log(`Player ${playerName} (ID: ${playerId}) ${action} with bet ${betAmount}`);
  }

  public getAggressivenessScore(playerId: number): number {
    return this.playerStats.get(playerId)?.aggressivenessScore || 0.5;
  }

  public getAllPlayerStats(): PlayerStats[] {
    return Array.from(this.playerStats.values());
  }

  private updateAggressivenessScore(playerId: number): void {
    const stats = this.playerStats.get(playerId);
    if (!stats || stats.actions.length === 0) return;

    // Look at the last 20 actions or all if fewer
    const recentActions = stats.actions.slice(-20);
    
    // Count aggressive actions (raises)
    const raiseCount = recentActions.filter(a => a.action === 'raise').length;
    const foldCount = recentActions.filter(a => a.action === 'fold').length;
    
    // Calculate aggressiveness (0-1 scale)
    const totalActions = recentActions.length;
    const aggressivenessScore = Math.min(
      1.0,
      Math.max(
        0.1,
        (raiseCount / totalActions) * 0.8 + 0.2 * (1 - foldCount / totalActions)
      )
    );
    
    stats.aggressivenessScore = aggressivenessScore;
    console.log(`Updated aggressiveness score for player ${stats.name}: ${aggressivenessScore.toFixed(2)}`);
  }

  public logPlayerStats(): void {
    console.log("\n=== PLAYER STATISTICS ===");
    this.getAllPlayerStats().forEach(player => {
      console.log(`${player.name} (ID: ${player.id}): Aggressiveness = ${player.aggressivenessScore.toFixed(2)}`);
      console.log(`  Total actions: ${player.actions.length}`);
      const raises = player.actions.filter(a => a.action === 'raise').length;
      const calls = player.actions.filter(a => a.action === 'call').length;
      const folds = player.actions.filter(a => a.action === 'fold').length;
      console.log(`  Raises: ${raises}, Calls: ${calls}, Folds: ${folds}`);
    });
    console.log("========================\n");
  }
}
