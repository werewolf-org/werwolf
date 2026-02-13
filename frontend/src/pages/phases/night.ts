import type { View } from '../../router';
import nightHtml from './night.html?raw';
import { subscribeSelector, getState } from '../../store';
import { Role, ROLES } from '@shared/roles.js';
import { WerewolvesPhase } from './werewolves';
import { SeerPhase } from './seer';
import { RedLadyPhase } from './red-lady';
import { WitchPhase } from './witch';

export class NightPhase implements View {
    private container: HTMLElement | null = null;
    private currentSubView: View | null = null;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = nightHtml;

        // Subscribe to changes in the active role and the player's own role
        subscribeSelector(s => s.activeNightRole, () => {
            this.updateNightView();
        })

        subscribeSelector(s => s.role, () => {
            this.updateNightView();
        })

        // Initial render
        this.updateNightView();
    }

    private updateNightView() {
        const state = getState();
        const activeRole = state.activeNightRole;
        const ownRole = state.role;
        
        const me = state.players.find(p => p.playerUUID === state.playerUUID);
        const isDead = me && !me.isAlive;

        const actionContainer = document.getElementById('night-action-container');
        const sleepView = document.getElementById('night-sleep-view');
        const errorView = document.getElementById('night-error-view');
        const deadView = document.getElementById('night-dead-view');
        const turnDisplay = document.getElementById('night-current-turn-display');
        const deadTurnDisplay = document.getElementById('night-dead-turn-display');

        // Reset all displays first (clean slate)
        if (actionContainer) actionContainer.style.display = 'none';
        if (sleepView) sleepView.style.display = 'none';
        if (errorView) errorView.style.display = 'none';
        if (deadView) deadView.style.display = 'none';

        // 0. Update turn display text (for both living and dead)
        if (activeRole) {
            const roleDef = ROLES[activeRole as Role];
            const text = `Current Turn: ${roleDef?.pluralName || activeRole}`;
            if (turnDisplay) turnDisplay.innerText = text;
            if (deadTurnDisplay) deadTurnDisplay.innerText = text;
        }

        // 1. Handle Dead Player
        if (isDead) {
            if (deadView) deadView.style.display = 'block';
            return;
        }

        // 2. Handle NULL/Error case
        if (activeRole === null) {
            if (errorView) errorView.style.display = 'block';
            return;
        }

        // 3. Logic: Who gets to see the Action UI?
        // It's my turn (activeRole == myRole)
        const isMyTurn = (activeRole && activeRole === ownRole);

        if (isMyTurn) {
            if (actionContainer) actionContainer.style.display = 'block';
            this.renderActionUI(activeRole);
        } else {
            if (sleepView) sleepView.style.display = 'block';
        }
    }

    private renderActionUI(role: Role) {
        const actionContainer = document.getElementById('night-action-container');
        if (!actionContainer) return;

        // Check if we need to switch sub-views
        if (role === Role.WEREWOLF) {
            if (!(this.currentSubView instanceof WerewolvesPhase)) {
                this.currentSubView = new WerewolvesPhase();
                this.currentSubView.mount(actionContainer);
            }
        } else if (role === Role.SEER) {
            if (!(this.currentSubView instanceof SeerPhase)) {
                this.currentSubView = new SeerPhase();
                this.currentSubView.mount(actionContainer);
            }
        } else if (role === Role.RED_LADY) {
            if (!(this.currentSubView instanceof RedLadyPhase)) {
                this.currentSubView = new RedLadyPhase();
                this.currentSubView.mount(actionContainer);
            }
        } else if (role === Role.WITCH) {
            if (!(this.currentSubView instanceof WitchPhase)) {
                this.currentSubView = new WitchPhase();
                this.currentSubView.mount(actionContainer);
            }
        } else {
            // Default rig for other roles
            this.currentSubView = null;
            
            actionContainer.innerHTML = `
                <div class="pixel-card">
                    <h3>Wake up, ${role}!</h3>
                    <div id="role-specific-content">
                        <!-- Implement ${role} logic here -->
                        <p>Performing night actions...</p>
                    </div>
                </div>
            `;
        }
    }
}