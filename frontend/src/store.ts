import { Role} from '@shared/roles.js'
import { Phase } from '@shared/models.js';

export interface Player {
    playerUUID: string, 
    displayName: string,
    isAlive: boolean,
    isSherriff: boolean,
    role: Role | null,
}

interface AppState {
    isConnected: boolean,

    // global
    gameId: string | null,
    phase: Phase| null,
    activeNightRole: Role | null,
    players: Player[];
    
    // private
    playerUUID: string | null,
    displayName: string | null,
    isManager: boolean,
    role: Role | null,
    lovePartnerUUID: string | null,
    
    // phase & turn specific
    seerReveal: { playerUUID: string, role: Role } | null;
    witchData: { victimUUID: string | null, usedHealingPotion: boolean, usedKillingPotion: boolean } | null;

    voteResults: Record<string, string | null> | null;
    votedOutUUID: string | null;
}

const state: AppState = {
    gameId: null,
    playerUUID: localStorage.getItem('playerUUID') ?? null,

    isConnected: false,
    isManager: false,
    displayName: null,
    lovePartnerUUID: null,
    role: null,
    phase: null,
    activeNightRole: null,

    players: [],

    seerReveal: null,
    witchData: null,
    voteResults: null,
    votedOutUUID: null,
};


type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): Readonly<AppState> {
    return Object.freeze({ ...state });
}

export function setState(patch: Partial<AppState>): void {
    Object.assign(state, patch);
    const updatedState = getState();
    listeners.forEach((fn) => fn(updatedState));
}

export function subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Subscribe to a specific part of the state. 
export function subscribeSelector<T>(
    selector: (state: AppState) => T,
    fn: (value: T) => void
): () => void {
    let lastValue = selector(state);
    return subscribe((newState) => {
        const newValue = selector(newState);
        if (newValue !== lastValue) {
            lastValue = newValue;
            fn(newValue);
        }
    });
}

export function resetState(): void {
    Object.assign(state, {
        playerUUID: localStorage.getItem('playerUUID') ?? null,

        isConnected: false,
        isManager: false,
        displayName: null,
        lovePartnerUUID: null,
        role: null,
        phase: null,
        activeNightRole: null,
        round: 0,

        players: [],
        seerReveal: null,
    });
}