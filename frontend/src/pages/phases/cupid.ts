import type { View } from '../../router';
import cupidHtml from './cupid.html?raw';
import { getState, subscribeSelector } from '../../store';
import { socketService } from '../../socket.service';
import { Role } from '@shared/roles.js';

export class CupidPhase implements View {
    private container: HTMLElement | null = null;
    private selectedTargetUUIDs: string[] = [];
    private hasActed: boolean = false;
    private hasConfirmedLove: boolean = false;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = cupidHtml;

        subscribeSelector(s => s.lovePartnerUUID, () => {
            this.updateView();
        });

        this.setupCupidListeners();
        this.setupLoverListeners();
        this.updateView();
    }

    private updateView() {
        const state = getState();
        const selectionView = document.getElementById('cupid-selection-view');
        const loversView = document.getElementById('lovers-view');
        const waitingMsg = document.getElementById('cupid-waiting-message');

        if (selectionView) selectionView.style.display = 'none';
        if (loversView) loversView.style.display = 'none';
        if (waitingMsg) waitingMsg.style.display = 'none';

        // 1. If I am a lover and haven't confirmed yet
        if (state.lovePartnerUUID && !this.hasConfirmedLove) {
            if (loversView) {
                loversView.style.display = 'block';
                const partner = state.players.find(p => p.playerUUID === state.lovePartnerUUID);
                const partnerNameEl = document.getElementById('partner-name');
                if (partnerNameEl) partnerNameEl.innerText = partner ? partner.displayName : 'Unknown';
            }
        } 
        // 2. If I am Cupid and haven't acted yet
        else if (state.role === Role.CUPID && !this.hasActed) {
            if (selectionView) {
                selectionView.style.display = 'block';
                this.renderPlayerList();
            }
        }
        // 3. Waiting state
        else {
            if (waitingMsg) {
                waitingMsg.style.display = 'block';
                const waitText = document.getElementById('cupid-wait-text');
                if (this.hasConfirmedLove) {
                    if (waitText) waitText.innerText = "You have accepted your love. Waiting for your partner...";
                }
            }
        }
    }

    private setupCupidListeners() {
        const confirmBtn = document.getElementById('confirm-cupid-target-btn') as HTMLButtonElement;
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (this.selectedTargetUUIDs.length === 2 && !this.hasActed) {
                    this.hasActed = true;
                    socketService.makeLove(this.selectedTargetUUIDs[0]!, this.selectedTargetUUIDs[1]!);
                    this.updateView();
                }
            });
        }
    }

    private setupLoverListeners() {
        const confirmBtn = document.getElementById('confirm-love-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (!this.hasConfirmedLove) {
                    this.hasConfirmedLove = true;
                    socketService.lovePartnerConfirms();
                    this.updateView();
                }
            });
        }
    }

    private renderPlayerList() {
        const listEl = document.getElementById('cupid-target-list');
        if (!listEl) return;

        const state = getState();
        const players = state.players.filter(p => p.isAlive);
        
        listEl.innerHTML = players.map(p => `
            <li class="pixel-list-item selectable-player" data-uuid="${p.playerUUID}">
                <span class="player-dot alive"></span>
                <span class="player-name">${p.displayName}</span>
            </li>
        `).join('');

        const items = listEl.querySelectorAll('.selectable-player');
        items.forEach(item => {
            item.addEventListener('click', () => {
                if (this.hasActed) return;

                const uuid = item.getAttribute('data-uuid');
                if (!uuid) return;

                if (this.selectedTargetUUIDs.includes(uuid)) {
                    // Deselect
                    this.selectedTargetUUIDs = this.selectedTargetUUIDs.filter(id => id !== uuid);
                    item.classList.remove('selected');
                } else if (this.selectedTargetUUIDs.length < 2) {
                    // Select
                    this.selectedTargetUUIDs.push(uuid);
                    item.classList.add('selected');
                }

                this.updateSelectionUI();
            });
        });
    }

    private updateSelectionUI() {
        const countEl = document.getElementById('cupid-selection-count');
        const confirmBtn = document.getElementById('confirm-cupid-target-btn') as HTMLButtonElement;
        
        if (countEl) countEl.innerText = `${this.selectedTargetUUIDs.length} / 2 Selected`;
        if (confirmBtn) confirmBtn.disabled = this.selectedTargetUUIDs.length !== 2;
    }
}
