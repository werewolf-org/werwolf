import type { View } from '../../router';
import redLadyHtml from './red-lady.html?raw';
import { getState } from '../../store';
import { socketService } from '../../socket.service';

export class RedLadyPhase implements View {
    private container: HTMLElement | null = null;
    private selectedTargetUUID: string | null = null;
    private hasActed: boolean = false;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = redLadyHtml;

        this.renderPlayerList();

        const confirmBtn = document.getElementById('confirm-sleepover-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (this.selectedTargetUUID && !this.hasActed) {
                    this.hasActed = true;
                    socketService.sleepOver(this.selectedTargetUUID);
                    this.updateUIState();
                }
            });
        }
    }

    private updateUIState() {
        const controls = this.container?.querySelector('.manager-controls') as HTMLElement;
        const waitingMsg = document.getElementById('red-lady-waiting-message');
        const listEl = document.getElementById('red-lady-target-list');

        if (this.hasActed) {
            if (controls) controls.style.display = 'none';
            if (waitingMsg) waitingMsg.style.display = 'block';
            
            // Disable interactions
            if (listEl) {
                listEl.style.pointerEvents = 'none';
                listEl.style.opacity = '0.7';
            }
        }
    }

    private renderPlayerList() {
        const listEl = document.getElementById('red-lady-target-list');
        if (!listEl) return;

        const state = getState();
        // Filter out myself (Red Lady) and dead players
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
                const confirmBtn = document.getElementById('confirm-sleepover-btn') as HTMLButtonElement;
                if (confirmBtn) confirmBtn.disabled = false;
            });
        });
    }
}