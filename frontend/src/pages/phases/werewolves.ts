import type { View } from '../../router';
import werewolvesHtml from './werewolves.html?raw';
import { getState } from '../../store';
import { socketService } from '../../socket.service';

export class WerewolvesPhase implements View {
    private container: HTMLElement | null = null;
    private selectedTargetUUID: string | null = null;
    private hasVoted: boolean = false;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = werewolvesHtml;

        this.renderPlayerList();

        const confirmBtn = document.getElementById('confirm-werewolf-target-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (this.selectedTargetUUID && !this.hasVoted) {
                    this.hasVoted = true;
                    socketService.werewolfVote(this.selectedTargetUUID);
                    this.updateUIState();
                }
            });
        }
    }

    private updateUIState() {
        const controls = this.container?.querySelector('.manager-controls') as HTMLElement;
        const waitingMsg = document.getElementById('werewolf-waiting-message');
        const listEl = document.getElementById('werewolf-target-list');

        if (this.hasVoted) {
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
        const listEl = document.getElementById('werewolf-target-list');
        if (!listEl) return;

        const players = getState().players.filter(p => p.isAlive);
        
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
                if (this.hasVoted) return;

                // Clear previous selection
                items.forEach(i => i.classList.remove('selected'));
                
                // Set new selection
                item.classList.add('selected');
                this.selectedTargetUUID = item.getAttribute('data-uuid');
                
                // Enable confirm button
                const confirmBtn = document.getElementById('confirm-werewolf-target-btn') as HTMLButtonElement;
                if (confirmBtn) confirmBtn.disabled = false;
            });
        });
    }
}
