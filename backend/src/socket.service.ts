import { Server } from 'socket.io';

export class SocketService {
    private static instance: SocketService;
    private io: Server | null = null;

    private constructor() {}

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public init(io: Server) {
        this.io = io;
    }

    private getIO(): Server {
        if (!this.io) {
            throw new Error('SocketService not initialized! Call init(io) first.');
        }
        return this.io;
    }

    // --- Room Management ---

    public joinRoom(socketId: string, roomId: string) {
        const socket = this.getIO().sockets.sockets.get(socketId);
        if (socket) {
            socket.join(roomId);
        }
    }

    public leaveRoom(socketId: string, roomId: string) {
        const socket = this.getIO().sockets.sockets.get(socketId);
        if (socket) {
            socket.leave(roomId);
        }
    }

    // --- Generic Emitters ---

    public emitToRoom(roomId: string, event: string, data: any) {
        this.getIO().to(roomId).emit(event, data);
    }

    public emitToPlayer(socketId: string, event: string, data: any) {
        this.getIO().to(socketId).emit(event, data);
    }

    // --- Game Specific Emitters (Domain Logic) ---

    public syncState(socketId: string, localState: object) {
        this.emitToPlayer(socketId, 'syncState', localState)
    }

    public notifyGameCreated(socketId: string, gameId: string) {
        this.emitToPlayer(socketId, 'gameCreated', { gameId });
    }

    public notifyPlayerJoined(socketId: string, data: { gameId: string, playerUUID: string }) {
        this.emitToPlayer(socketId, 'joinedGame', data);
    }

    // public notifyPlayerRejoined(socketId: string, data: { gameId: string, playerUUID: string, isManager: boolean, role: Role | null, phase: Phase, activeNightRole: Role | null, displayName: string, lovePartnerUUID: string | null, players: any[], voteResults: Record<string, string | null> | null, votedOutUUID: string | null}) {
    //     this.emitToPlayer(socketId, 'rejoinedGame', data);
    // };

    // public notifyPlayerUpdate(gameId: string, players: any[]) {
    //     this.emitToRoom(gameId, 'updatePlayers', { players });
    // }

    // public notifyPhaseUpdate(gameId: string, phase: Phase) {
    //     this.emitToRoom(gameId, 'updatePhase', { phase });
    // }

    // public notifyRoleAssigned(socketId: string, role: Role) {
    //     this.emitToPlayer(socketId, 'roleAssigned', { role });
    // }

    // public notifyNextActiveRole(gameId: string, role: Role) {
    //     this.emitToRoom(gameId, 'nextActiveRole', { role });
    // }

    // public notifyVotingResolved(gameId: string, votedOutUUID: string | null, allVotes: Record<string, string | null>) {
    //     this.emitToRoom(gameId, 'votingResolved', { votedOutUUID, allVotes });
    // }

    // TODO: check if game is over -> emit gameOver (with winners)

    // --- Role Specific Notifications ---

    // public notifyWerewolfVote(socketId: string, targetUUID: string) {
    //     this.emitToPlayer(socketId, 'werewolfVote', { targetUUID });
    // }

    // public notifySeerResult(socketId: string, targetUUID: string, role: Role) {
    //     this.emitToPlayer(socketId, 'seePlayer', { playerUUID: targetUUID, role });
    // }

    // public notifyNewCouple(socketId: string) {
    //     this.emitToPlayer(socketId, 'newCouple', {});
    // }

    // public notifyLovePartner(socketId: string, partnerUUID: string) {
    //     this.emitToPlayer(socketId, 'lovePartner', { partnerUUID });
    // }

    // public notifyWitchData(socketId: string, victimUUID: string | null, usedHealingPotion: boolean, usedKillingPotion: boolean) {
    //     this.emitToPlayer(socketId, 'witchData', { victimUUID, usedHealingPotion, usedKillingPotion});
    // }

    // --- Error Handling ---

    public notifyError(socketId: string, message: string) {
        console.error(`ERROR on socket ${socketId}: ${message}`);
        this.emitToPlayer(socketId, 'error', { message });
    }
}

export const socketService = SocketService.getInstance();