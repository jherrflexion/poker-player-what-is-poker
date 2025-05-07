export interface TeamData {
  name: string;
  points: number;
  language: string;
}

export interface TournamentData {
  teams: TeamData[];
  status: string;
}

export class TournamentDataService {
  private static instance: TournamentDataService;
  private tournamentData: TournamentData | null = null;
  private lastFetchTime: number = 0;
  private readonly FETCH_INTERVAL = 30000; // 30 seconds
  private readonly TOURNAMENT_URL = 'https://live.leanpoker.org/api/tournament/6818cec57ae3c70002c56326';
  private lowestScoreTeam: TeamData | null = null;

  private constructor() {}

  public static getInstance(): TournamentDataService {
    if (!TournamentDataService.instance) {
      TournamentDataService.instance = new TournamentDataService();
    }
    return TournamentDataService.instance;
  }

  public async fetchTournamentData(): Promise<void> {
    const currentTime = Date.now();
    
    // Only fetch if we haven't fetched recently
    if (currentTime - this.lastFetchTime > this.FETCH_INTERVAL) {
      try {
        console.log("Fetching tournament data...");
        const response = await fetch(this.TOURNAMENT_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch tournament data: ${response.status}`);
        }
        
        const data = await response.json();
        this.tournamentData = data;
        this.lastFetchTime = currentTime;
        
        this.processTeamData();
        console.log("Tournament data updated successfully");
      } catch (error) {
        console.error("Error fetching tournament data:", error);
      }
    }
  }

  private processTeamData(): void {
    if (!this.tournamentData || !this.tournamentData.teams || this.tournamentData.teams.length === 0) {
      return;
    }

    // Filter out our own team
    const otherTeams = this.tournamentData.teams.filter(team => 
      team.name !== "What Is Poker" && !team.name.includes("Bluffy") && 
      !team.name.includes("Winnie") && !team.name.includes("Darth")
    );
    
    if (otherTeams.length === 0) {
      return;
    }

    // Find the team with the lowest score
    this.lowestScoreTeam = otherTeams.reduce((lowest, current) => 
      (current.points < lowest.points) ? current : lowest, 
      otherTeams[0]
    );

    console.log(`Identified lowest score team: ${this.lowestScoreTeam.name} with ${this.lowestScoreTeam.points} points`);
  }

  public getLowestScoreTeam(): TeamData | null {
    return this.lowestScoreTeam;
  }

  public isLowestScoreTeam(playerName: string): boolean {
    if (!this.lowestScoreTeam) return false;
    
    // Check if the player name contains the team name or vice versa
    return playerName.toLowerCase().includes(this.lowestScoreTeam.name.toLowerCase()) || 
           this.lowestScoreTeam.name.toLowerCase().includes(playerName.toLowerCase());
  }
}
