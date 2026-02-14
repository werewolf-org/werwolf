import { Role } from '@shared/roles.js'
import { Phase } from '@shared/models.js';

export interface Player {
    playerUUID: string | null,
    socketId: string | null,
    displayName: string,
    role: Role | null,
    voteTargetUUID: string | null, // who they vote for
    nightAction: object | null,
    isAlive: boolean,
    isSheriff: boolean,
    lovePartner: string | null,
    lovePartnerConfirmed: boolean,
    usedHealingPotion: boolean,
    usedKillingPotion: boolean,
    readyForNight: boolean
}

export interface Game {
    gameId: string,
    managerUUID: string | null, // PlayerUUID of Game Manager
    players: Player[],
    round: number,
    phase: Phase,
    activeNightRole: Role | null,



    lynchResults: {voteResults: Record<string, string | null> , votedOutUUID: string | null} | null;
}

// aggregated state
// voteResults: Record<string, string | null> | null
// votedOutUUID: string | null
// -> aggregated from Player.voteTargetUUID

// werewolfVotes: Record<string, string> | null
// werewolfVictim: string | null
// -> aggregated from Player.nightAction

// redLadySleepoverUUID: string | null
// -> aggregated from Player.nightAction