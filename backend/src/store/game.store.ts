import type { Game } from "../models.js";

export class GameStore {
    private static instance: GameStore;
    private games: Map<string, Game> = new Map();

    static getInstance(): GameStore {
        if(!GameStore.instance) GameStore.instance = new GameStore();
        return this.instance;
    }

    createGame(game: Game): void {
        this.games.set(game.gameId, game);
    }

    getGame(gameId: string): Game | undefined {
        return this.games.get(gameId);
    }

    updateGame(game: Game): void {
        this.games.set(game.gameId, game);
    }

    deleteGame(gameId: string): void {
        this.games.delete(gameId);
    }

    clear(): void {
        this.games.clear();
    }


}