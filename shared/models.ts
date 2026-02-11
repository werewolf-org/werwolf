export enum Phase {
    LOBBY = "LOBBY",
    ROLE_SELECTION = "ROLE_SELECTION",
    DISTRIBUTION = "DISTRIBUTION",
    NIGHT = "NIGHT",
    DAY = "DAY",
    GAME_OVER = "GAME_OVER"
}

// export interface NightActions {
//     [Role.WEREWOLF]?: { targetUUID: string | null };
//     [Role.SEER]?: { targetUUID: string };
//     [Role.CUPID]?: { targetUUIDs: [string, string] };
//     [Role.WITCH]?: { 
//         usedHeal: boolean; 
//         usedKillUUID: string | null; 
//     };
//     [Role.RED_LADY]?: { targetUUID: string };
// }

// export interface NightAction {
//     // werewolf, seer, red_lady
//     targetUUID?: string | null,
//     // witch
//     usedHeal?: boolean,
//     usedKillUUID?: string | null,
//     // cupid
//     multiTargetUUIDs?: string[] | null,
// }