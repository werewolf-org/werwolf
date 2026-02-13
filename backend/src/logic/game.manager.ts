import { GameStore } from "../store/game.store.js";
import { type Game, type Player } from "../models.js";
import { Role, ROLES } from '@shared/roles.js';
import { Phase } from "@shared/models.js";
import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'socket.io';
import { socketService } from "../socket.service.js";
import { checkCoupleDying } from "./role.handler.js";

export class GameManager {
    private store = GameStore.getInstance();

    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    createGame(socketId: string): void {
        const gameId = this.generateGameId();

        const newGame: Game = {
            gameId: gameId,
            manager: null,
            players: [],
            round: 0,
            phase: Phase.LOBBY,
            activeNightRole: null
        }

        socketService.notifyGameCreated(socketId, gameId);
        this.store.createGame(newGame);
        socketService.joinRoom(socketId, gameId);
        this.pushPlayerList(newGame);
        console.log(`Game ${gameId} was created`);
    }

    joinGame(socketId: string, gameId: string, playerUUID: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        
        const newUUID = uuidv4();
        // fork: either JOIN or REJOIN game
        // TODO: make it also possible to RE-JOIN in the Lobby
        if(game.phase === Phase.LOBBY) this.newPlayer(game.gameId, socketId, newUUID);
        else this.rejoinGame(game.gameId, playerUUID, socketId);
        
        socketService.joinRoom(socketId, game.gameId);
        this.pushPlayerList(game);

        console.log(`Player ${playerUUID} joined game ${gameId}`);
    }
    
    private newPlayer(gameId: string, socketId: string, playerUUID: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        const isManager = game.players.length === 0;
        const newPlayer: Player = {
            displayName: '',
            role: null,
            voteTargetUUID: null,
            socketId: socketId,
            playerUUID: playerUUID, 
            nightAction: null,
            isGameMaster: isManager,
            isAlive: true,
            isSheriff: false,
            lovePartner: null,
            usedHealingPotion: false,
            usedKillingPotion: false,
            readyForNight: false
        }

        game?.players.push(newPlayer);
        socketService.notifyPlayerJoined(socketId, {
          gameId: gameId,
          playerUUID: playerUUID,
          activeNightRole: game.activeNightRole,
          isManager: newPlayer.isGameMaster
        })
        this.store.updateGame(game);
    }


    private rejoinGame(gameId: string, playerUUID: string | null, socketId: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        const playerWithID = game.players.find((player) => player.playerUUID == playerUUID);
        if(!playerWithID) throw new Error(`Player with UUID ${playerUUID} not found in Game`);
        playerWithID.socketId = socketId;
        this.store.updateGame(game);
    }

    pushPlayerList(game: Game): void {
        const playerList = game.players.map(p => ({
            playerUUID: p.playerUUID,
            displayName: p.displayName,
            isAlive: p.isAlive,
            role: p.isAlive ? null : p.role
        }));
        socketService.notifyPlayerUpdate(game.gameId, playerList);
    }

    changeName(gameId: string, playerUUID: string, playerName: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`);
        if(game.phase !== Phase.LOBBY) throw new Error(`Game with ID ${game.gameId} not in Phase LOBBY, so name change not possible!`);
        const playerWithID = game.players.find((player) => player.playerUUID == playerUUID);
        if(!playerWithID) throw new Error(`Player with UUID ${playerUUID} not found in Game`);
        playerWithID.displayName = playerName;
        this.pushPlayerList(game);
        console.log(`Player ${playerUUID} changed name to ${playerName}`)!
        this.store.updateGame(game);
    }

    closeJoining(gameId: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        if(game.phase !== Phase.LOBBY) throw new Error(`Game ${gameId} is already in progress, so joining cannot be closed.`);

        game.phase = Phase.ROLE_SELECTION;
        this.pushPlayerList(game);
        socketService.notifyPhaseUpdate(game.gameId, game.phase);
        this.store.updateGame(game);
    }

    private shuffledIndices(n: number): number[] {
        const a = Array.from({ length: n }, (_, i) => i);

        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            const tmp = a[i]!;
            a[i] = a[j]!;
            a[j] = tmp;
        }
        return a;
    }

    startDistribution(gameId: string, roles: Record<Role, number>): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        if(game.phase !== Phase.ROLE_SELECTION) throw new Error(`Game ${gameId} is currently not in phase ROLE_SELECTION, so Distribution cannot start!`);
        if(game.players === undefined) throw new Error(`No players are defined in game ${gameId}`);

        const shuffledPlayerIndices: number[] = this.shuffledIndices(game.players.length);

        let i: number = 0;
        Object.entries(roles).forEach(([role, amount]) => {
            for (let j = i; j < i + (amount as number); j++) {
                const playerIndex = shuffledPlayerIndices[j];
                if (playerIndex === undefined) throw new Error(`No index found in shuffledPlayerIndices at position ${j}`);
                const player = game.players[playerIndex];
                if (!player) throw new Error(`Player index ${playerIndex} does not exist in game ${gameId}`)
                player.role = role as Role; 
            }
            i += amount as number;
        });

        game.phase = Phase.DISTRIBUTION;
        game.players.forEach(player => {
            if (player.socketId && player.role) {
                socketService.notifyRoleAssigned(player.socketId, player.role);
            } else {
                throw new Error(`Player ${player.playerUUID} does not have a socketId (${player.socketId}) or a role (${player.role})`);
            }
        });
        console.log(`Roles distributed for game ${gameId}`);
        this.store.updateGame(game);
    }

    startGame(gameId: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        if(game.phase !== Phase.DISTRIBUTION) throw new Error(`Game ${gameId} is not currently in the right phase to be started!`);
        game.phase = Phase.NIGHT;
        game.activeNightRole = this.getFirstToWakeUp(game.players);
        socketService.notifyPhaseUpdate(game.gameId, Phase.NIGHT);
        if(game.activeNightRole) socketService.notifyNextActiveRole(game.gameId, game.activeNightRole);
        else throw new Error(`Game ${game.gameId} does not have an active night role (${game.activeNightRole}), although the game started!`);
        console.log(`Game ${gameId} started...`)
        this.store.updateGame(game);
    }

    private getFirstToWakeUp(players: Player[]): Role | null {
        const rolesInGame = new Set(players.filter(p => p.isAlive).map(p => p.role));

        // Determine the order of roles that wake up this night
        const wakeOrder = (Object.keys(ROLES) as Role[])
            .filter(role => ROLES[role].wakesUp && rolesInGame.has(role))
            .sort((a, b) => ROLES[a].nightOrder - ROLES[b].nightOrder);
        
        return wakeOrder[0] ?? null;
    }

    // nightAction(gameId: string, socketId: string, action: NightAction, role: Role, io: Server): Game {
    //     const game = this.store.getGame(gameId);
    //     if(!game) throw new Error(`Game with ID ${gameId} not found!`)
    //     if(game.phase !== Phase.NIGHT) throw new Error(`Game ${gameId} is not current in Night Phase, cannot do Night Action!`);

    //     // check if player exists & has correct role
    //     const player = game.players.find((player) => player.socketId === socketId);
    //     if(player === undefined) throw new Error(`Player with socketId ${socketId} not found in ${gameId}`);
    //     if(player.role !== role) throw new Error(`Player with UUID ${player.playerUUID} does not have the correct role to do the night action`);
    //     if(player.nightAction) throw new Error(`Player with UUID ${player.playerUUID} already did a night action`);

    //     switch(role){ 
    //         case Role.WEREWOLF: WerewolfHandler.handleNightAction(game, player, action, io); break;
    //         case Role.SEER: SeerHandler.handleNightAction(game, player, action, io); break;
    //         case Role.CUPID: CupidHandler.handleNightAction(game, player, action, io); break;
    //         case Role.WITCH: WitchHandler.handleNightAction(game, player, action, io); break;
    //         case Role.RED_LADY: RedLadyHandler.handleNightAction(game, player, action, io); break;
    //         case Role.VILLAGER: throw new Error(`Role ${role} does note wake up, no Night Action`);
    //         case Role.LITTLE_GIRL: throw new Error(`Role ${role} does note wake up, no Night Action`);
    //         case Role.HUNTER: throw new Error(`Role ${role} does note wake up, no Night Action`);
    //         default: break;
    //     }

    //     this.store.updateGame(game);
    //     return game;
    // }

    private getPlayerFromNight(game: Game, socketId: string, role: Role): Player {
        if(game.phase !== Phase.NIGHT) throw new Error(`Game ${game.gameId} is not current in Night Phase, cannot do Night Action!`);

        // check if player exists & has correct role
        const player = game.players.find((player) => player.socketId === socketId);
        if(!player) throw new Error(`Player with socketId ${socketId} not found in ${game.gameId}`);
        if(player.role !== role) throw new Error(`Player with UUID ${player.playerUUID} does not have the correct role to do the night action of the role (${player.role} !== ${role})`);
        if(ROLES[player.role].wakesUp === false) throw new Error(`Player ${player.playerUUID} has role ${player.role}, but it doesnt wake up in the night`);
        return player;
    }

    nightAction<T extends any[]> (gameId: string, socketId: string, role: Role,
        handler: (game: Game, player: Player, ...args: T) => void,
        ...handlerArgs: T
    ): void {
        const game = this.store.getGame(gameId);
        if (!game) throw new Error(`Game with ID ${gameId} not found!`);
        const player = this.getPlayerFromNight(game, socketId, role);

        handler(game, player, ...handlerArgs);
        this.store.updateGame(game);
    }

    vote(gameId: string, socketId: string, targetUUID: string): void {
        const game = this.store.getGame(gameId);
        if(!game) throw new Error(`Game with ID ${gameId} not found!`)
        if(game.phase !== Phase.DAY) throw new Error(`Game with ID ${gameId} is not in Phase DAY, so voting cannot happen right now`)
        
        const player = game.players.find((player) => player.socketId === socketId);
        if(!player) throw new Error(`Player with socketId ${socketId} not found in ${gameId}`);
        if(player.voteTargetUUID) throw new Error(`Player with socketId ${socketId} already voted`)
        
        player.voteTargetUUID = targetUUID;

        const everyoneVoted: boolean = this.checkIfEveryoneVoted(game);
        if(everyoneVoted) {
            const votedOutPlayer = this.resolveVoting(game);
            this.pushPlayerList(game);
            console.log(`Voting Resolved in Game ${gameId}. Player voted out: ${votedOutPlayer?.playerUUID}`)
        }

        this.store.updateGame(game);
    }

    private checkIfEveryoneVoted(game: Game): boolean {
        if(game.phase !== Phase.DAY) throw new Error(`Game with ID ${game.gameId} is not in Phase DAY, so voting cannot happen right now`)

        const alivePlayers = game.players.filter((player) => player.isAlive)
        const playersWhoVotes = alivePlayers.filter((player) => player.voteTargetUUID !== null);
        return playersWhoVotes.length === alivePlayers.length;
    }
    
    private resolveVoting(game: Game): Player | null {
        if(game.phase !== Phase.DAY) throw new Error(`Game with ID ${game.gameId} is not in Phase DAY, so voting cannot happen right now`)

        const voteRecord: Record<string, string | null> = Object.fromEntries(
            game.players
                .filter(p => p.playerUUID !== null)
                .map(p => [p.playerUUID, p.voteTargetUUID])
        );
        
        const votes: Record<string, number> = {}
        const alivePlayers = game.players.filter((player) => player.isAlive)
        alivePlayers.forEach((player) => {
            if(!player.voteTargetUUID) throw new Error(`Player with player UUID ${player.playerUUID} did not vote yet, resolving not possible`)
            votes[player.voteTargetUUID] = (votes[player.voteTargetUUID] ?? 0) + 1;
        });

        const entries = Object.entries(votes);
        if (entries.length === 0) throw new Error("No votes present");

        const maxCount = Math.max(...Object.entries(votes).map(([, count]) => count));
        const electedPlayers = entries
            .filter(([, count]) => count === maxCount)
            .map(([uuid]) => uuid); 

        let electedPlayerUUID: string | null = null;
        if(electedPlayers.length === 1) electedPlayerUUID = electedPlayers[0] ?? null;
        else if(electedPlayers.length > 1) {
            const sheriff = alivePlayers.find((player) => player.isSheriff)
            if(sheriff && sheriff.voteTargetUUID && electedPlayers.includes(sheriff.voteTargetUUID)) electedPlayerUUID = sheriff.voteTargetUUID;
        }

        const electedPlayer = alivePlayers.find((player) => player.playerUUID === electedPlayerUUID) ?? null;
        if(electedPlayer) {
            electedPlayer.isAlive = false;
            checkCoupleDying(game, electedPlayer.playerUUID);
        }

        // reset votes
        game.players.forEach((player) => player.voteTargetUUID = null);

        socketService.notifyVotingResolved(game.gameId, electedPlayer?.playerUUID ?? null, voteRecord);

        // turn to night
        this.store.updateGame(game);
        return electedPlayer;

    }

    readyForNight(gameId: string, socketId: string) {
        const game = this.store.getGame(gameId);
        if (!game) throw new Error(`Game with ID ${gameId} not found!`);
        if(game.phase !== Phase.DAY) throw new Error(`Game ${game.gameId} is not currently in Day Phase (Phase: ${game.phase}), cannot confirm ready for night`);
        const player = game.players.find((player) => player.socketId === socketId);
        if(!player) throw new Error(`Player with socketId ${socketId} not found in ${game.gameId}`);
        if(!player.isAlive) throw new Error(`Player with socketId ${socketId} is not alive anymore in game ${game.gameId}`);
        player.readyForNight = true;

        const alivePlayers = game.players.filter((player) => player.isAlive)
        const readyPlayers = alivePlayers.filter((player) => player.readyForNight);
        console.log(socketId, alivePlayers.length, readyPlayers.length);
        if(alivePlayers.length === readyPlayers.length) {
            // go to night phase
            game.phase = Phase.NIGHT;
            game.activeNightRole = this.getFirstToWakeUp(game.players);
            if(!game.activeNightRole) throw new Error(`Game with ID ${gameId} cannot go to Night, no first night role`)
            socketService.notifyNextActiveRole(game.gameId, game.activeNightRole);

            game.players.forEach((player) => player.readyForNight = false);
        }
        this.store.updateGame(game);
    }

}