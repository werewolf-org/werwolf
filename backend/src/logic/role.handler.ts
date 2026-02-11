import { Role, ROLES } from "@shared/roles.js";
import { type Game, type Player } from "../models.js";
import { Phase } from "@shared/models.js";
import { socketService } from "../socket.service.js";

export const nextRole = (game: Game) => {
    const rolesInGame = new Set(game.players.filter(p => p.isAlive).map(p => p.role));

    // Determine the order of roles that wake up this night
    const wakeOrder = (Object.keys(ROLES) as Role[])
        .filter(role => ROLES[role].wakesUp && rolesInGame.has(role))
        .sort((a, b) => ROLES[a].nightOrder - ROLES[b].nightOrder);

    // Find where we are in the sequence
    const currentIndex = game.activeNightRole ? wakeOrder.indexOf(game.activeNightRole) : 0;
    const nextActiveRole = wakeOrder[currentIndex + 1];

    if (nextActiveRole) {
        // Advance to the next role
        game.activeNightRole = nextActiveRole;
        socketService.notifyNextActiveRole(game.gameId, nextActiveRole);
    } else {
        // End of Night -> Start Day
        game.activeNightRole = null;
        game.phase = Phase.DAY;

        resolveNightActions(game);

        // const deadRoles = game.players
        //     .filter(p => !p.isAlive)
        //     .map(p => ({ uuid: p.playerUUID, role: p.role }));

        const playerList = game.players.map(p => ({
            playerUUID: p.playerUUID,
            displayName: p.displayName,
            isAlive: p.isAlive
        }));

        game.players.forEach((player) => player.nightAction = null);
        socketService.notifyPlayerUpdate(game.gameId, playerList);
        socketService.notifyPhaseUpdate(game.gameId, Phase.DAY);
    }
};

// TODO: put to utils
export const getMostVotes = (votes: string[]): string[] => {
    if (votes.length === 0) return [];
    const mapping: Record<string, number> = {};
    let maxCount = 0;
    let results: string[] = [];
    for (const str of votes) {
        const count = (mapping[str] || 0) + 1;
        mapping[str] = count;

        if (count > maxCount) {
        maxCount = count;
        }
    }
    for (const str in mapping) {
        if (mapping[str] === maxCount) {
        results.push(str);
        }
    }
    return results;
}

export const resolveNightActions = (game: Game) => {
    const werewolves = game.players.filter((players) => players.role === Role.WEREWOLF);
    const werewolfVotes = werewolves.map((werewolf) => (werewolf.nightAction as Record<string, any>).targetUUID ?? '');
    const mostVoted = getMostVotes(werewolfVotes);
    const werewolfTargetUUID: string | null = (mostVoted.length === 1 && mostVoted[0] && mostVoted[0] != '') ? mostVoted[0] : null;

    const witch = game.players.find((player) => player.role === Role.WITCH)
    const witchAction = witch?.nightAction as Record<string, any>;
    const witchHeal: boolean = witchAction?.heal ?? false;
    const witchKillUUID: string | null = witchAction?.killUUID ?? null; 

    const redLady = game.players.find((player) => player.role === Role.RED_LADY);
    const redLadyAction = redLady?.nightAction as Record<string, any>;
    if(redLadyAction && redLadyAction.sleepoverUUID === undefined) throw new Error(`Red Lady Action exists but no targetUUID`)
    const redLadySleepoverUUID: string | null = redLadyAction?.sleepoverUUID ?? null;

    let dyingPlayerUUIDs: string[] = [];

    // werewolf kill
    if(werewolfTargetUUID && !witchHeal) dyingPlayerUUIDs.push(werewolfTargetUUID);

    // witch kill
    if(witchKillUUID && !dyingPlayerUUIDs.includes(witchKillUUID)) dyingPlayerUUIDs.push(witchKillUUID);

    // red lady logic
    const redLadyUUID = game.players.filter((player) => player.isAlive).find((player) => player.role === Role.RED_LADY)?.playerUUID ?? null;
    if(redLadyUUID) {
        dyingPlayerUUIDs = dyingPlayerUUIDs.filter((victim) => victim !== redLadyUUID);
        dyingPlayerUUIDs.forEach((victim) => {
            if(victim === redLadySleepoverUUID && !dyingPlayerUUIDs.includes(redLadyUUID)) dyingPlayerUUIDs.push(redLadyUUID)
        })
    }

    // couple dying
    dyingPlayerUUIDs.forEach((playerUUID) => checkCoupleDying(game, playerUUID));

    // TODO: edge case - what if the red lady sleeps at the love partner's place

    game.players.forEach((player) => {
        if(player.playerUUID && dyingPlayerUUIDs.includes(player.playerUUID)) player.isAlive = false;
    })

    const playerList = game.players.map(p => ({
        playerUUID: p.playerUUID,
        displayName: p.displayName,
        isAlive: p.isAlive
    }));
    socketService.notifyPlayerUpdate(game.gameId, playerList);
}

export const checkCoupleDying = (game: Game, dyingUUID: string | null) => {
    if(!dyingUUID) return;
    const lovePartnerUUID = game.players.find((player) => player.playerUUID === dyingUUID)?.lovePartner;
    if(!lovePartnerUUID) return;
    const lovePartner = game.players.find((player) => player.playerUUID === lovePartnerUUID);
    if(!lovePartner) throw new Error(`Player with ${lovePartnerUUID} does not exist, cannot be a love partner`);
    lovePartner.isAlive = false;
    return lovePartnerUUID;
}

export const WerewolfHandler = {
    handleVote(game: Game, player: Player, targetUUID: string): void {
        // send vote to all werewolves
        const aliveWerewolves = game.players.filter((player) => player.isAlive === true && player.role === Role.WEREWOLF)
        aliveWerewolves.forEach((werewolfPlayer) => {
            if(!werewolfPlayer.socketId) throw new Error(`Player ${player.playerUUID} does not have a socketId`);
            socketService.notifyWerewolfVote(werewolfPlayer.socketId, targetUUID,)
        })
        player.nightAction = { targetUUID: targetUUID };

        //check if everyone Voted
        const wolvesWithoutVotes = aliveWerewolves.filter((werewolf) => !werewolf.nightAction)
        if (!wolvesWithoutVotes || wolvesWithoutVotes.length === 0) nextRole(game);
    }
}

export const SeerHandler = {
    handleSeeingRole(game: Game, player: Player, revealUUID: string): void {
        const playerToSee = game.players.find((player) => player.playerUUID === revealUUID);
        if(!playerToSee) throw new Error(`Player with UUID ${revealUUID} not found, cannot see this players role`);
        if(!playerToSee.role) throw new Error(`Player with UUID ${revealUUID} does not have a role`);
        if(player.socketId) socketService.notifySeerResult(player.socketId, revealUUID, playerToSee.role);
    },
    handleConfirm(game: Game) {
        nextRole(game);
    }
}

export const CupidHandler = {
    handleMakeLove(game: Game, player: Player, firstPlayerUUID: string, secondPlayerUUID: string): void {

        if(game.round && game.round > 0) throw new Error(`Game ${game.gameId} is already in round ${game.round}, so cupid cannot do action`)
        
        const firstPlayerInLove = game.players.find((player) => player.playerUUID === firstPlayerUUID);
        const secondPlayerInLove = game.players.find((player) => player.playerUUID === secondPlayerUUID);
        if(!firstPlayerInLove) throw new Error(`Player with ID ${firstPlayerUUID} not found`);
        if(!secondPlayerInLove) throw new Error(`Player with ID ${firstPlayerUUID} not found`);
        firstPlayerInLove.lovePartner = secondPlayerInLove.playerUUID;
        secondPlayerInLove.lovePartner = firstPlayerInLove.playerUUID;
        
        if(firstPlayerInLove.socketId) socketService.notifyLovePartner(firstPlayerInLove.socketId, secondPlayerUUID);
        if(secondPlayerInLove.socketId) socketService.notifyLovePartner(secondPlayerInLove.socketId, firstPlayerUUID);
    },
    // TODO (nextRole)
    // WARNING: here the player is not the cupid
    handleLovePartnerConfirms(game: Game, player: Player) {}
}

export const WitchHandler = {
    handlePotion(game: Game, player: Player, heal: boolean | null, killUUID: string | null) {
        if(!heal && !killUUID) throw new Error(`Witch with ID ${player.playerUUID} didn't use a Potion`)

        if(heal) {
            if(player.usedHealingPotion) throw new Error(`Witch in Game ${game.gameId} already used healing potion`);
            if(!player.nightAction) player.nightAction = { heal: heal }
            else player.nightAction = {...player.nightAction, heal: heal }
        }
        if(killUUID) {
            if(player.usedKillingPotion) throw new Error(`Witch in Game ${game.gameId} already used killing potino`) 
            if(!player.nightAction) player.nightAction = { killUUID: killUUID }
            else player.nightAction = {...player.nightAction, killUUID: killUUID }
        }
        if(player.socketId) socketService.notifyWitchPotionSucess(player.socketId);
    },
    // TODO
    handleConfirm(game: Game, player: Player) {}
}

export const RedLadyHandler = {
    handleSleepover(game: Game, player: Player, sleepoverUUID: string): void {
        if(player.socketId) socketService.notifyRedLadySleepover(player.socketId, sleepoverUUID);
        player.nightAction = { sleepoverUUID: sleepoverUUID };
        nextRole(game);
    }
}