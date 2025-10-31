// HoopScores Rotator 3000 - Main Application Script

class BoxscoreRotator {
    constructor() {
        this.games = [];
        this.currentGameIndex = 0;
        this.rotationInterval = null;
        this.isRotating = true;
        this.lastFetchDate = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadYesterdayGames();
    }

    initializeElements() {
        this.boxscoreContainer = document.getElementById('boxscore-container');
        this.currentGameNumber = document.getElementById('current-game-number');
        this.totalGames = document.getElementById('total-games');
        this.gameInfo = document.getElementById('game-info');
        this.lastUpdated = document.getElementById('last-updated');
        
        // Control buttons
        this.prevButton = document.getElementById('prev-game');
        this.nextButton = document.getElementById('next-game');
        this.toggleButton = document.getElementById('toggle-rotation');
    }

    setupEventListeners() {
        this.prevButton.addEventListener('click', () => this.previousGame());
        this.nextButton.addEventListener('click', () => this.nextGame());
        this.toggleButton.addEventListener('click', () => this.toggleRotation());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousGame();
            if (e.key === 'ArrowRight') this.nextGame();
            if (e.key === ' ') this.toggleRotation();
        });
    }

    async loadYesterdayGames() {
        try {
            // Get yesterday's date in EST
            const yesterday = this.getYesterdayDateEST();
            this.lastFetchDate = yesterday;
            
            const scoreboardUrl = `https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${yesterday}`;
            
            const response = await fetch(scoreboardUrl);
            const data = await response.json();
            
            // Filter for completed games from yesterday
            this.games = (data.events || []).filter(event => {
                const status = event.status?.type?.state;
                return status === 'post'; // Only finished games
            });
            
            this.updateGameCount();
            
            if (this.games.length > 0) {
                this.displayCurrentGame();
                this.startRotation();
            } else {
                this.showNoGamesMessage();
            }
            
            this.updateLastUpdatedTime();
        } catch (error) {
            console.error('Error loading games:', error);
            this.showErrorMessage('Failed to load boxscores. Please try again later.');
        }
    }

    getYesterdayDateEST() {
        const now = new Date();
        const estOffset = -5 * 60; // EST is UTC-5
        const estTime = new Date(now.getTime() + (estOffset + now.getTimezoneOffset()) * 60000);
        
        // Subtract one day
        estTime.setDate(estTime.getDate() - 1);
        
        // Format as YYYYMMDD
        const year = estTime.getFullYear();
        const month = String(estTime.getMonth() + 1).padStart(2, '0');
        const day = String(estTime.getDate()).padStart(2, '0');
        
        return `${year}${month}${day}`;
    }

    async displayCurrentGame() {
        if (this.games.length === 0) return;
        
        const game = this.games[this.currentGameIndex];
        this.boxscoreContainer.innerHTML = this.createLoadingHTML();
        
        try {
            const boxscoreData = await this.fetchBoxscore(game.id);
            if (boxscoreData) {
                this.renderBoxscore(boxscoreData, game);
            }
        } catch (error) {
            console.error('Error displaying game:', error);
            this.showErrorMessage('Failed to load boxscore for this game.');
        }
    }

    async fetchBoxscore(gameId) {
        const boxscoreUrl = `https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
        
        const response = await fetch(boxscoreUrl);
        return await response.json();
    }

    renderBoxscore(boxscoreData, game) {
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        const playersByTeam = boxscoreData.boxscore?.players || [];
        const homePlayers = playersByTeam.find(p => p.team.id === homeTeam.team.id);
        const awayPlayers = playersByTeam.find(p => p.team.id === awayTeam.team.id);
        
        const html = `
            <div class="boxscore-fade-in">
                <!-- Game Header -->
                <div class="team-header grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="flex items-center justify-center space-x-3">
                        <img src="${awayTeam.team.logo}" alt="${awayTeam.team.displayName}" class="w-12 h-12">
                        <div class="text-center">
                            <div class="font-bold text-lg">${awayTeam.team.abbreviation}</div>
                            <div class="text-xl font-bold">${awayTeam.score || 0}</div>
                        </div>
                    </div>
                    <div class="flex flex-col items-center justify-center">
                        <div class="text-sm opacity-90">FINAL</div>
                            <div class="text-xs opacity-75">${game.status?.type?.detail || ''}</div>
                        </div>
                    <div class="flex items-center justify-center space-x-3">
                        <div class="text-center">
                            <div class="font-bold text-lg">${homeTeam.team.abbreviation}</div>
                            <div class="text-xl font-bold">${homeTeam.score || 0}</div>
                        </div>
                        <img src="${homeTeam.team.logo}" alt="${homeTeam.team.displayName}" class="w-12 h-12">
                    </div>
                </div>
<!-- Player Stats -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                        ${this.renderTeamStats(awayPlayers, awayTeam.team.displayName)}
                        ${this.renderTeamStats(homePlayers, homeTeam.team.displayName)}
                    </div>
                </div>
            </div>
        `;
        
        this.boxscoreContainer.innerHTML = html;
        this.updateGameInfo(game, homeTeam, awayTeam);
    }
    renderTeamStats(teamData, teamName) {
        if (!teamData || !teamData.statistics || teamData.statistics.length === 0) {
            return `
                <div class="team-stats">
                    <h3 class="text-lg font-semibold mb-4 text-gray-800">${teamName}</h3>
                    <p class="text-gray-500 text-center py-8">No player data available</p>
                </div>
            `;
        }
        
        const stats = teamData.statistics[0];
        const headers = stats.labels || [];
        const athletes = stats.athletes || [];
        
        // Filter out OREB and DREB headers and stats
        const rebIndex = headers.findIndex(header => header === 'REB');
        const orebIndex = headers.findIndex(header => header === 'OREB');
        const drebIndex = headers.findIndex(header => header === 'DREB');
        
        // Create new headers and stats arrays without OREB and DREB
        const filteredHeaders = headers.filter((header, index) => {
            return header !== 'OREB' && header !== 'DREB';
        });
        
        const filteredAthletes = athletes.map(athlete => {
            const filteredStats = athlete.stats.filter((stat, index) => {
                return headers[index] !== 'OREB' && headers[index] !== 'DREB';
            });
            return { ...athlete, stats: filteredStats };
        });
        
        return `
            <div class="team-stats">
                <h3 class="text-lg font-semibold mb-4 text-gray-800">${teamName}</h3>
                <div class="overflow-x-auto">
                    <table class="stats-table w-full">
                        <thead>
                            <tr>
                                <th class="text-left pr-4">Player</th>
                                ${filteredHeaders.map(header => `<th class="text-right px-2">${header}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredAthletes.map(athlete => `
                                <tr class="hover:bg-gray-50">
                                    <td class="font-medium text-left pr-4">${athlete.athlete.displayName}</td>
                                    ${athlete.stats.map(stat => `<td class="text-right px-2">${stat}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
updateGameInfo(game, homeTeam, awayTeam) {
        const venue = game.competitions[0]?.venue?.fullName || 'NBA Arena';
        const date = new Date(game.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        this.gameInfo.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800">${awayTeam.team.displayName} @ ${homeTeam.team.displayName}</h2>
            <p class="text-gray-600">${venue} • ${date}</p>
        `;
    }

    nextGame() {
        this.currentGameIndex = (this.currentGameIndex + 1) % this.games.length;
        this.displayCurrentGame();
        this.updateGameCount();
    }

    previousGame() {
        this.currentGameIndex = this.currentGameIndex === 0 ? this.games.length - 1 : this.currentGameIndex - 1;
        this.displayCurrentGame();
        this.updateGameCount();
    }

    startRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        
        this.rotationInterval = setInterval(() => {
            if (this.isRotating) {
                this.nextGame();
            }
        }, 15000); // 15 seconds per game
    }

    toggleRotation() {
        this.isRotating = !this.isRotating;
        
        const icon = this.isRotating ? 'pause' : 'play';
        const text = this.isRotating ? 'Pause' : 'Resume';
        
        this.toggleButton.innerHTML = `
            <i data-feather="${icon}" class="w-4 h-4 mr-2"></i>
            ${text}
        `;
        
        feather.replace();
    }

    updateGameCount() {
        this.currentGameNumber.textContent = this.currentGameIndex + 1;
        this.totalGames.textContent = this.games.length;
    }

    updateLastUpdatedTime() {
        const now = new Date();
        this.lastUpdated.textContent = now.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            dateStyle: 'medium',
            timeStyle: 'medium'
        });
    }

    createLoadingHTML() {
        return `
            <div class="text-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p class="mt-4 text-gray-500">Loading boxscore data...</p>
            </div>
        `;
    }

    showNoGamesMessage() {
        this.boxscoreContainer.innerHTML = `
            <div class="text-center py-16">
                <i data-feather="calendar" class="w-16 h-16 text-gray-400 mx-auto"></i>
                <h3 class="text-xl font-semibold text-gray-600 mt-4">No Games Yesterday</h3>
                <p class="text-gray-500 mt-2">There were no NBA games played yesterday.</p>
            </div>
        `;
        feather.replace();
    }

    showErrorMessage(message) {
        this.boxscoreContainer.innerHTML = `
            <div class="text-center py-16">
                <i data-feather="alert-triangle" class="w-16 h-16 text-red-400 mx-auto"></i>
                <h3 class="text-xl font-semibold text-gray-600 mt-4">Unable to Load Data</h3>
                <p class="text-gray-500 mt-2">${message}</p>
            </div>
        `;
        feather.replace();
    }
}

// Auto-refresh at 2 AM EST
function scheduleDailyRefresh() {
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Set target time to 2 AM EST
    const targetTime = new Date(estTime);
    targetTime.setHours(2, 0, 0, 0);
    
    // If it's already past 2 AM today, schedule for tomorrow
    if (estTime >= targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const timeUntilRefresh = targetTime - estTime;
    
    setTimeout(() => {
        window.location.reload();
    }, timeUntilRefresh);
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.boxscoreRotator = new BoxscoreRotator();
    scheduleDailyRefresh();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.boxscoreRotator) {
        const currentDate = window.boxscoreRotator.getYesterdayDateEST();
        if (currentDate !== window.boxscoreRotator.lastFetchDate) {
        window.location.reload();
    }
    }
});