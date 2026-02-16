import { Role } from '@shared/roles.js'
import { Phase } from '@shared/phases.js';

export interface Player {
    playerUUID: string | null,
    socketId: string | null,
    displayName: string,
    role: Role | null,
    voteTargetUUID: string | null, // who they vote for
    nightAction: NightAction | null,
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

    lynchDone: boolean,
    votedOutUUID: string | null,
}

export interface NightAction {
    // werewolf
    targetUUID?: string | null,
    // seer
    revealUUID?: string,
    revealedRole?: Role,
    // witch
    heal?: boolean,
    killUUID?: string | null,
    // cupid
    firstPlayerUUID?: string,
    secondPlayerUUID?: string,
    // red lady
    sleepoverUUID?: string
}

// # aggregated state (for frontend UI)

// voteResults: Record<string, string | null> | null
// votedOutUUID: string | null
// -> aggregated from Player.voteTargetUUID

// werewolfVotes: Record<string, string> | null
// werewolfVictim: string | null
// -> aggregated from Player.nightAction

// redLadySleepoverUUID: string | null
// -> aggregated from Player.nightAction

// cupidFirstLoverUUID: string | null
// cupidSecondLoverUUID: string | null
// -> aggregated from Player.nightAction

// witchUsedHealingPotion: boolean
// witchUsedKillingPotion: boolean