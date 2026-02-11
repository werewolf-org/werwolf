import type { View } from '../../router';
import nightHtml from './night.html?raw';
import { subscribeSelector, getState } from '../../store';
import { Role, ROLES } from '@shared/roles.js';
import { WerewolvesPhase } from './werewolves';
import { SeerPhase } from './seer';

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

        subscribeSelector(s => s.seerReveal, () => {
            this.updateNightView();
        })

        // Initial render
        this.updateNightView();
    }

    private updateNightView() {
        const state = getState();
        const activeRole = state.activeNightRole;
        const ownRole = state.role;
        const seerReveal = state.seerReveal;
        
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

        // 2. Handle Seer Reveal (Highest Priority for the Seer)
        // ... (rest of logic)
        // - It's my turn (activeRole == myRole)
        // - OR: I am the Seer AND I have a pending reveal to see (seerReveal != null)
        const isMyTurn = (activeRole && activeRole === ownRole);
        const isPendingSeerReveal = (seerReveal !== null && ownRole === Role.SEER);

        if (isMyTurn || isPendingSeerReveal) {
            if (actionContainer) actionContainer.style.display = 'block';
            
            // Determine which role view to render
            // If I am the Seer with a reveal, I force the Seer view, even if it's someone else's turn now.
            const roleToRender = isPendingSeerReveal ? Role.SEER : (activeRole as Role);
            
            this.renderActionUI(roleToRender);
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