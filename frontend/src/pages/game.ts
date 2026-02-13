import gameHtml from './game.html?raw';
import type { View } from '../router';
import { subscribeSelector, getState, resetGame } from '../store';
import { Phase } from '@shared/models.js';
import { LobbyPhase } from './phases/lobby';
import { PlaceholderPhase } from './phases/placeholder';
import { RoleSelectionPhase } from './phases/role-selection';
import { socketService } from '../socket.service';
import { RoleDistributionPhase } from './phases/role-distribution';
import { NightPhase } from './phases/night';
import { DayPhase } from './phases/day';

export class GamePage implements View {
    private gameId: string;
    private container: HTMLElement | null = null;
    private phaseContainer: HTMLElement | null = null;
    
    // Track the current sub-view
    private currentPhaseView: View | null = null;

    constructor(gameId: string) {
        this.gameId = gameId;
    }

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = gameHtml;

        this.phaseContainer = document.getElementById('phase-view-container');
        
        // cleanup state
        resetGame();

        console.log('joining or re-joining...');
        socketService.joinGame(this.gameId, getState().playerUUID ?? null);

        console.log(`GamePage mounted for ${this.gameId}`);

        subscribeSelector(s => s.phase, (phase) => {
            if (phase) this.renderPhase(phase);
        })
    }

    private renderPhase(phase: Phase): void {
        if (!this.phaseContainer) return;

        // Safety: Ensure Dark Mode if not in Day Phase
        if (phase !== Phase.DAY) {
            document.body.classList.remove('light-mode');
        }

        switch (phase) {
            case Phase.LOBBY:
                this.currentPhaseView = new LobbyPhase();
                break;
            case Phase.ROLE_SELECTION:
                this.currentPhaseView = new RoleSelectionPhase();
                break;
            case Phase.DISTRIBUTION:
                this.currentPhaseView = new RoleDistributionPhase();
                break;
            case Phase.NIGHT:
                this.currentPhaseView = new NightPhase();
                break;
            case Phase.DAY:
                this.currentPhaseView = new DayPhase();
                break;
            default:
                this.currentPhaseView = new PlaceholderPhase(phase);
                break;
        }

        this.phaseContainer.innerHTML = '';
        this.currentPhaseView.mount(this.phaseContainer);
    }
}
