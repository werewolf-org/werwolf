import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameManager } from '../src/logic/game.manager.js';
import { GameStore } from '../src/store/game.store.js';
import { Role } from '@shared/roles.js';
import { Phase, type NightAction } from '@shared/models.js';
import type { Server } from 'socket.io';

// Mock Socket.IO Server
const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
} as unknown as Server;

describe('GameManager', () => {
    let gameManager: GameManager;
    let store: GameStore;

    beforeEach(() => {
        store = GameStore.getInstance();
        store.clear();
        gameManager = new GameManager();
        vi.clearAllMocks();
    });

    it('should create a game', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        expect(game.gameId).toBeDefined();
        expect(game.players.length).toBe(1);
        expect(game.players[0]?.displayName).toBe('Ben');
        expect(game.players[0]?.isGameMaster).toBe(true);
        expect(game.phase).toBe(Phase.LOBBY);
    });

    it('should allow players to join', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        const player = gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        
        expect(game.players.length).toBeGreaterThan(1);
        expect(player.displayName).toBe('Alice');
        expect(player.isGameMaster).toBe(false);
        expect(player.isAlive).toBe(true);
    });

    it('should allow players to rejoin', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        const player = gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        const playerUUID = player.playerUUID!;

        const updatedGame = gameManager.rejoinGame(game.gameId, playerUUID, 'socket-new');
        const updatedPlayer = updatedGame.players.find(p => p.playerUUID === playerUUID);

        expect(updatedPlayer?.socketId).toBe('socket-new');
        expect(updatedGame.players.length).toBe(2);
    });

    it('should close joining and move to role selection', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.closeJoining(game.gameId);
        expect(game.phase).toBe(Phase.ROLE_SELECTION);

        expect(() => gameManager.joinGame(game.gameId, 'Alice', 'socket-2')).toThrowError();
    });

    it('should distribute roles correctly', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Bob', 'socket-4');
        
        gameManager.closeJoining(game.gameId);
        
        const roles = {
            [Role.WEREWOLF]: 1,
            [Role.VILLAGER]: 2,
            [Role.SEER]: 1,
        } as Record<Role, number>;

        gameManager.startDistribution(game.gameId, roles);
        
        expect(game.phase).toBe(Phase.DISTRIBUTION);
        const wolves = game.players.filter(p => p.role === Role.WEREWOLF);
        const villagers = game.players.filter(p => p.role === Role.VILLAGER);
        const seers = game.players.filter(p => p.role === Role.SEER);
        const cupids = game.players.filter(p => p.role === Role.CUPID);
        
        expect(wolves.length).toBe(1);
        expect(villagers.length).toBe(2);
        expect(seers.length).toBe(1);
        expect(cupids.length).toBe(0);
    });

    it('should start the game and move to night', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Bob', 'socket-4');
        gameManager.closeJoining(game.gameId);
        
        const roles = { [Role.WEREWOLF]: 1, [Role.VILLAGER]: 1, [Role.WITCH]: 1, [Role.CUPID]: 1 } as Record<Role, number>;
        gameManager.startDistribution(game.gameId, roles);
        
        gameManager.startGame(game.gameId);
        
        expect(game.phase).toBe(Phase.NIGHT);
        expect(game.activeNightRole).toBe(Role.CUPID);
        expect(game.players.length).toBe(4);
    });

    it('should handle night actions and advance roles', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Bob', 'socket-4');
        gameManager.closeJoining(game.gameId);
        
        const roles = { [Role.WEREWOLF]: 1, [Role.VILLAGER]: 1, [Role.WITCH]: 1, [Role.SEER]: 1 } as Record<Role, number>;
        gameManager.startDistribution(game.gameId, roles);
        gameManager.startGame(game.gameId);

        expect(game.activeNightRole).toBe(Role.WEREWOLF);

        const wolf = game.players.find(p => p.role === Role.WEREWOLF)!;
        const witch = game.players.find(p => p.role === Role.WITCH)!;
        const seer = game.players.find(p => p.role === Role.SEER)!;

        // Wolf action
        gameManager.nightAction(game.gameId, wolf.socketId!, {
            targetUUID: witch.playerUUID
        }, Role.WEREWOLF, mockIo);

        expect(wolf.nightAction).toStrictEqual({targetUUID: witch.playerUUID});
        expect(game.activeNightRole).toBe(Role.SEER);
        expect(wolf.nightAction).toBeDefined();

        // Seer action
        gameManager.nightAction(game.gameId, seer.socketId!, {
            targetUUID: wolf.playerUUID! 
        }, Role.SEER, mockIo);

        expect(game.activeNightRole).toBe(Role.WITCH);
        expect(seer.nightAction).toBeDefined();

        // Witch action
        gameManager.nightAction(game.gameId, witch.socketId!, {
            usedHeal: true, usedKillUUID: null
        }, Role.WITCH, mockIo);

        expect(game.phase).toBe(Phase.DAY);
        expect(game.activeNightRole).toBeNull();
    });

    it('should resolve simple night actions (Werewolf kills, Witch heals)', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.closeJoining(game.gameId);
        
        const roles = { [Role.WEREWOLF]: 1, [Role.WITCH]: 1 } as Record<Role, number>;
        gameManager.startDistribution(game.gameId, roles);
        gameManager.startGame(game.gameId);

        const wolf = game.players.find(p => p.role === Role.WEREWOLF)!;
        const witch = game.players.find(p => p.role === Role.WITCH)!;

        // Wolf kills Witch
        gameManager.nightAction(game.gameId, wolf.socketId!, {
            targetUUID: witch.playerUUID
        }, Role.WEREWOLF, mockIo);

        // Witch DOES NOT heal
        gameManager.nightAction(game.gameId, witch.socketId!, {
            usedHeal: false, usedKillUUID: null
        }, Role.WITCH, mockIo);

        gameManager.resolveNightActions(game.gameId);
        
        expect(witch.isAlive).toBe(false);
        expect(wolf.isAlive).toBe(true);
        expect(game.phase).toBe(Phase.DAY);
    });

    it('should resolve complex night actions', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Bob', 'socket-4');
        gameManager.joinGame(game.gameId, 'Devin', 'socket-5');
        gameManager.closeJoining(game.gameId);

        const roles = { [Role.RED_LADY]: 1, [Role.WITCH]: 1, [Role.WEREWOLF]: 1, [Role.SEER]: 1, [Role.VILLAGER]: 1 } as Record<Role, number>;
        gameManager.startDistribution(game.gameId, roles);
        gameManager.startGame(game.gameId);

        const wolf = game.players.find(p => p.role === Role.WEREWOLF)!;
        const witch = game.players.find(p => p.role === Role.WITCH)!;
        const red_lady = game.players.find(p => p.role === Role.RED_LADY)!;
        const seer = game.players.find(p => p.role === Role.SEER)!;

        // Red Lady sleeps at wolf
        gameManager.nightAction(game.gameId, red_lady.socketId! , {
            targetUUID: wolf.playerUUID!
        }, Role.RED_LADY, mockIo);

        // Wolf kills Red Lady
        gameManager.nightAction(game.gameId, wolf.socketId!, {
            targetUUID: red_lady.playerUUID
        }, Role.WEREWOLF, mockIo);

        // Seer sees Wolf
        gameManager.nightAction(game.gameId, seer.socketId!, {
            targetUUID: wolf.playerUUID!
        }, Role.SEER, mockIo);

        // Witch DOES NOT heal, and KILLS seer
        gameManager.nightAction(game.gameId, witch.socketId!, {
            usedHeal: false, usedKillUUID: seer.playerUUID
        }, Role.WITCH, mockIo);
         
        gameManager.resolveNightActions(game.gameId);

        expect(red_lady.isAlive).toBe(true); // Saved by sleeping at wolf
        expect(wolf.isAlive).toBe(true);
        expect(seer.isAlive).toBe(false); // Killed by witch
        expect(witch.isAlive).toBe(true);
    });
    
    it('should resolve complex night actions with couple and multiple wolves', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Bob', 'socket-4');
        gameManager.joinGame(game.gameId, 'Devin', 'socket-5');
        gameManager.joinGame(game.gameId, 'Louis', 'socket-6');
        gameManager.joinGame(game.gameId, 'Calvin', 'socket-7');
        gameManager.closeJoining(game.gameId);

        const roles = { [Role.RED_LADY]: 1, [Role.WITCH]: 1, [Role.WEREWOLF]: 2, [Role.SEER]: 1, [Role.VILLAGER]: 1, [Role.CUPID]: 1 } as Record<Role, number>;
        gameManager.startDistribution(game.gameId, roles);
        gameManager.startGame(game.gameId);

        const cupid = game.players.find(p => p.role === Role.CUPID)!;
        const wolf1 = game.players.filter(p => p.role === Role.WEREWOLF)![0];
        const wolf2 = game.players.filter(p => p.role === Role.WEREWOLF)![1];
        const witch = game.players.find(p => p.role === Role.WITCH)!;
        const red_lady = game.players.find(p => p.role === Role.RED_LADY)!;
        const seer = game.players.find(p => p.role === Role.SEER)!;

        // Cupid makes love
        gameManager.nightAction(game.gameId, cupid.socketId! , {
            multiTargetUUIDs: [wolf1?.playerUUID!, cupid.playerUUID!]
        }, Role.CUPID, mockIo);

        // Red Lady sleeps at wolf
        gameManager.nightAction(game.gameId, red_lady.socketId! , {
            targetUUID: seer.playerUUID!
        }, Role.RED_LADY, mockIo);

        // Wolf kills Red Lady
        gameManager.nightAction(game.gameId, wolf1?.socketId!, {
            targetUUID: seer.playerUUID
        }, Role.WEREWOLF, mockIo);

        gameManager.nightAction(game.gameId, wolf2?.socketId!, {
            targetUUID: seer.playerUUID
        }, Role.WEREWOLF, mockIo);

        // Seer sees Red Lady
        gameManager.nightAction(game.gameId, seer.socketId!, {
            targetUUID: red_lady.playerUUID!
        }, Role.SEER, mockIo);

        // Witch DOES NOT heal, and KILLS cupid
        gameManager.nightAction(game.gameId, witch.socketId!, {
            usedHeal: false, usedKillUUID: cupid.playerUUID
        }, Role.WITCH, mockIo);
         
        gameManager.resolveNightActions(game.gameId);

        expect(cupid.isAlive).toBe(false);
        expect(wolf1?.isAlive).toBe(false);
        expect(wolf2?.isAlive).toBe(true);
        expect(red_lady.isAlive).toBe(false);
        expect(witch.isAlive).toBe(true);
        expect(seer.isAlive).toBe(false);
    });

    //TODO: test wolves votes have a tie

    it('should handle simple voting resolution', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        
        // Mocking DAY phase
        game.phase = Phase.DAY;
        
        const ben = game.players[0]!;
        const alice = game.players[1]!;
        const charlie = game.players[2]!;

        gameManager.vote(game.gameId, ben.socketId!, alice.playerUUID!);
        gameManager.vote(game.gameId, alice.socketId!, charlie.playerUUID!);
        gameManager.vote(game.gameId, charlie.socketId!, alice.playerUUID!);

        expect(gameManager.checkIfEveryoneVoted(game.gameId)).toBe(true);

        const killed = gameManager.resolveVoting(game.gameId);
        expect(killed?.playerUUID).toBe(alice.playerUUID);
        expect(alice.isAlive).toBe(false);
        expect(game.phase).toBe(Phase.NIGHT);
    });

    it('should handle tied voting resolution with sheriff', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Devin', 'socket-4');
        
        // Mocking DAY phase
        game.phase = Phase.DAY;
        
        const ben = game.players[0]!;
        const alice = game.players[1]!;
        const charlie = game.players[2]!;
        const devin = game.players[3]!;

        charlie.isSheriff = true;

        gameManager.vote(game.gameId, ben.socketId!, alice.playerUUID!);
        gameManager.vote(game.gameId, alice.socketId!, charlie.playerUUID!);
        gameManager.vote(game.gameId, charlie.socketId!, alice.playerUUID!);
        gameManager.vote(game.gameId, devin.socketId!, charlie.playerUUID!);

        expect(gameManager.checkIfEveryoneVoted(game.gameId)).toBe(true);

        const killed = gameManager.resolveVoting(game.gameId);
        expect(killed?.playerUUID).toBe(alice.playerUUID);
        expect(alice.isAlive).toBe(false);
        expect(charlie.isAlive).toBe(true);
        expect(game.phase).toBe(Phase.NIGHT);
    });

    it('should handle tied voting resolution without sheriff (no-one voted out)', () => {
        const game = gameManager.createGame('socket-1', 'Ben');
        gameManager.joinGame(game.gameId, 'Alice', 'socket-2');
        gameManager.joinGame(game.gameId, 'Charlie', 'socket-3');
        gameManager.joinGame(game.gameId, 'Devin', 'socket-4');
        
        // Mocking DAY phase
        game.phase = Phase.DAY;
        
        const ben = game.players[0]!;
        const alice = game.players[1]!;
        const charlie = game.players[2]!;
        const devin = game.players[3]!;

        gameManager.vote(game.gameId, ben.socketId!, alice.playerUUID!);
        gameManager.vote(game.gameId, alice.socketId!, charlie.playerUUID!);
        gameManager.vote(game.gameId, charlie.socketId!, alice.playerUUID!);
        gameManager.vote(game.gameId, devin.socketId!, charlie.playerUUID!);

        expect(gameManager.checkIfEveryoneVoted(game.gameId)).toBe(true);

        const killed = gameManager.resolveVoting(game.gameId);
        expect(killed?.playerUUID).toBeUndefined();
        expect(alice.isAlive).toBe(true);
        expect(charlie.isAlive).toBe(true);
        expect(game.phase).toBe(Phase.NIGHT);
    });
});
