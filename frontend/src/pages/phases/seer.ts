import type { View } from '../../router';
import seerHtml from './seer.html?raw';
import { getState, setState, subscribeSelector } from '../../store';
import { socketService } from '../../socket.service';
import { Role, ROLES } from '@shared/roles.js';

export class SeerPhase implements View {
    private container: HTMLElement | null = null;
    private selectedTargetUUID: string | null = null;
    private hasActed: boolean = false;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = seerHtml;

        // Subscribe to reveal state changes
        subscribeSelector(s => s.seerReveal, () => {
            this.updateView();
        });

        this.setupSelectionListeners();
        this.setupDismissListener();

        // Initial render
        this.updateView();
    }

    private updateView() {
        const state = getState();
        const reveal = state.seerReveal;
        
        const selectionView = document.getElementById('seer-selection-view');
        const revealView = document.getElementById('seer-reveal-view');

        if (reveal) {
            // SHOW REVEAL
            if (selectionView) selectionView.style.display = 'none';
            if (revealView) {
                revealView.style.display = 'block';
                this.renderRevealData(reveal);
            }
        } else {
            // SHOW SELECTION
            if (selectionView) selectionView.style.display = 'block';
            if (revealView) revealView.style.display = 'none';
            
            this.renderPlayerList();
        }
    }

    private renderRevealData(reveal: { playerUUID: string, role: Role }) {
        const state = getState();
        const targetPlayer = state.players.find(p => p.playerUUID === reveal.playerUUID);
        const targetName = targetPlayer ? targetPlayer.displayName : 'Unknown Player';
        const roleDef = ROLES[reveal.role];

        const imgEl = document.getElementById('reveal-role-image') as HTMLImageElement;
        const roleNameEl = document.getElementById('reveal-role-name');
        const playerNameEl = document.getElementById('reveal-player-name');

        if (imgEl) imgEl.src = `/${reveal.role.toUpperCase()}.png`;
        if (roleNameEl) roleNameEl.innerText = roleDef?.displayName || reveal.role;
        if (playerNameEl) playerNameEl.innerText = `${targetName} is...`;
    }

    private setupDismissListener() {
        const btn = document.getElementById('dismiss-reveal-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                // Tell backend we are done
                socketService.seerConfirmed();
                // Clear the reveal state. 
                setState({ seerReveal: null });
            });
        }
    }

    private setupSelectionListeners() {
        const confirmBtn = document.getElementById('confirm-seer-target-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (this.selectedTargetUUID && !this.hasActed) {
                    this.hasActed = true;
                    socketService.revealRole(this.selectedTargetUUID);
                    
                    // Show waiting state immediately
                    const controls = document.querySelector('.manager-controls') as HTMLElement;
                    const waitingMsg = document.getElementById('seer-waiting-message');
                    const listEl = document.getElementById('seer-target-list');

                    if (controls) controls.style.display = 'none';
                    if (waitingMsg) waitingMsg.style.display = 'block';
                    if (listEl) {
                        listEl.style.pointerEvents = 'none';
                        listEl.style.opacity = '0.7';
                    }
                }
            });
        }
    }

    private renderPlayerList() {
        const listEl = document.getElementById('seer-target-list');
        if (!listEl) return;

        const state = getState();
        // Filter out myself (Seer) and dead players
        const players = state.players.filter(p => p.isAlive && p.playerUUID !== state.playerUUID);
        
        listEl.innerHTML = players.map(p => `
            <li class="pixel-list-item selectable-player" data-uuid="${p.playerUUID}">
                <span class="player-dot alive"></span>
                <span class="player-name">${p.displayName}</span>
            </li>
        `).join('');

        // Selection logic
        const items = listEl.querySelectorAll('.selectable-player');
        items.forEach(item => {
            item.addEventListener('click', () => {
                if (this.hasActed) return;

                // Clear previous selection
                items.forEach(i => i.classList.remove('selected'));
                
                // Set new selection
                item.classList.add('selected');
                this.selectedTargetUUID = item.getAttribute('data-uuid');
                
                // Enable confirm button
                const confirmBtn = document.getElementById('confirm-seer-target-btn') as HTMLButtonElement;
                if (confirmBtn) confirmBtn.disabled = false;
            });
        });
    }
}