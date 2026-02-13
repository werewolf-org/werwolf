import { Role} from '@shared/roles.js'
import { Phase } from '@shared/models.js';

export interface Player {
    playerUUID: string | null,
    socketId: string | null,
    displayName: string,
    role: Role | null,
    voteTargetUUID: string | null, // who they vote for
    nightAction: object | null,
    isGameMaster: boolean,
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
    manager: string | null, // PlayerUUID of Game Manager
    players: Player[],
    round: number,
    phase: Phase,
    activeNightRole: Role | null,
    // TODO: define night Actions
}