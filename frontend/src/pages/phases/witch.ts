import type { View } from '../../router';
import witchHtml from './witch.html?raw';
import { getState, setState, subscribeSelector } from '../../store';
import { socketService } from '../../socket.service';

export class WitchPhase implements View {
    private container: HTMLElement | null = null;
    private hasConfirmed: boolean = false;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = witchHtml;
        
        subscribeSelector(s => s.witchData, () => {
            this.renderWitchView();
        });

        this.setupListeners();
        this.renderWitchView();
    }

    private renderWitchView() {
        const state = getState();
        const data = state.witchData;
        if (!data) return;

        // 1. Reveal Victim
        const victimMsg = document.getElementById('witch-victim-msg');
        const victimReveal = document.getElementById('witch-victim-reveal');
        
        if (data.victimUUID) {
            const victim = state.players.find(p => p.playerUUID === data.victimUUID);
            if (victimReveal) victimReveal.innerText = victim ? victim.displayName : 'Unknown';
        } else {
            if (victimMsg) victimMsg.innerText = "The Werewolves were peaceful tonight. No one was attacked.";
            if (victimReveal) victimReveal.innerText = "No One";
        }

        // 2. Heal Potion
        const healBtn = document.getElementById('use-heal-btn') as HTMLButtonElement;
        const healUsedMsg = document.getElementById('heal-used-msg');
        
        if (data.usedHealingPotion) {
            if (healBtn) healBtn.disabled = true;
            if (healUsedMsg) {
                healUsedMsg.style.display = 'block';
                healUsedMsg.innerText = "Potion already used this game.";
            }
        } else if (!data.victimUUID) {
            // No one to heal
            if (healBtn) healBtn.disabled = true;
        }

        // 3. Kill Potion
        const killBtn = document.getElementById('use-kill-btn') as HTMLButtonElement;
        const killUsedMsg = document.getElementById('kill-used-msg');
        const killSelection = document.getElementById('witch-kill-selection');
        
        if (data.usedKillingPotion) {
            if (killBtn) killBtn.disabled = true;
            if (killSelection) killSelection.style.display = 'none';
            if (killUsedMsg) {
                killUsedMsg.style.display = 'block';
                killUsedMsg.innerText = "Potion already used this game.";
            }
        }

        this.renderKillList();
    }

    private setupListeners() {
        const healBtn = document.getElementById('use-heal-btn');
        const killBtn = document.getElementById('use-kill-btn');
        const confirmBtn = document.getElementById('confirm-witch-actions-btn');

        if (healBtn) {
            healBtn.addEventListener('click', () => {
                const data = getState().witchData;
                if (data && data.victimUUID) {
                    socketService.usePotion('HEAL', null);
                    // UI deactivation happens via store subscription
                }
            });
        }

        if (killBtn) {
            killBtn.addEventListener('click', () => {
                const selection = document.getElementById('witch-kill-selection');
                if (selection) {
                    selection.style.display = selection.style.display === 'none' ? 'block' : 'none';
                }
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (!this.hasConfirmed) {
                    this.hasConfirmed = true;
                    socketService.witchConfirms();
                    setState({witchData: null});
                    
                    // Show waiting UI
                    const controls = document.querySelector('.manager-controls') as HTMLElement;
                    const waitingMsg = document.getElementById('witch-waiting-message');
                    if (controls) controls.style.display = 'none';
                    if (waitingMsg) waitingMsg.style.display = 'block';
                }
            });
        }
    }

    private renderKillList() {
        const listEl = document.getElementById('witch-kill-list');
        if (!listEl) return;

        const state = getState();
        // Witch can kill anyone alive except themselves
        const players = state.players.filter(p => p.isAlive && p.playerUUID !== state.playerUUID);
        
        listEl.innerHTML = players.map(p => `
            <li class="pixel-list-item selectable-player" data-uuid="${p.playerUUID}">
                <span class="player-dot alive"></span>
                <span class="player-name">${p.displayName}</span>
            </li>
        `).join('');

        const items = listEl.querySelectorAll('.selectable-player');
        items.forEach(item => {
            item.addEventListener('click', () => {
                if (this.hasConfirmed) return;

                items.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                
                const targetUUID = item.getAttribute('data-uuid');
                if (targetUUID) {
                    socketService.usePotion('KILL', targetUUID);
                }
            });
        });
    }
}
