import { View } from '../../base-view';
import lobbyHtml from './lobby.html?raw';
import { subscribeSelector, getState } from '../../store';
import QRCode from 'qrcode';
import { socketService } from '../../socket.service';

export class LobbyPhase extends View {

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = lobbyHtml;

        const state = getState();
        const gameId = state.gameId;
        
        // 1. Setup Game ID, Link & QR Code
        if (gameId) {
            const idEl = document.getElementById('lobby-game-id');
            if (idEl) idEl.innerText = gameId;

            const joinUrl = `${window.location.origin}/#/game/${gameId}`;
            const linkEl = document.getElementById('lobby-game-link');
            if (linkEl) linkEl.innerText = joinUrl;

            const qrContainer = document.getElementById('lobby-qr-code');
            if (qrContainer) {
                this.generateQRCode(joinUrl, qrContainer);
            }
        }

        // 2. Reactive Subscriptions
        this.unsubs.push(subscribeSelector(s => s.players, (players) => {
            this.updatePlayerList(players);
        }));

        this.unsubs.push(subscribeSelector(s => s.isManager, (isManager) => {
            this.toggleManagerUI(isManager);
        }));

        // Initial render
        this.updatePlayerList(state.players);
        this.toggleManagerUI(state.isManager);

        // 3. Setup Action Listeners
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.nameUnnamedPlayers();
                socketService.closeJoining();
            });
        }
    }

    private toggleManagerUI(isManager: boolean) {
        const controls = document.getElementById('manager-controls');
        const waitingMsg = document.getElementById('player-waiting-message');
        
        if (controls) controls.style.display = isManager ? 'block' : 'none';
        if (waitingMsg) waitingMsg.style.display = isManager ? 'none' : 'block';
    }

    private nameUnnamedPlayers() {
        const players = getState().players;
        let i = 1;
        players.forEach((player) => {
            if(player.displayName === '') socketService.changeName(player.playerUUID, `Unnamed Player ${i++}`);
        })
    }

    private async generateQRCode(url: string, container: HTMLElement) {
        try {
            const style = getComputedStyle(document.documentElement);
            const colorLight = style.getPropertyValue('--card-bg').trim() || '#1a1c29';

            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, url, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#ffffff',
                    light: colorLight
                }
            });
            container.appendChild(canvas);
        } catch (err) {
            console.error('QR Code generation failed', err);
            container.innerText = 'Failed to load QR Code';
        }
    }

    private updatePlayerList(players: any[]) {
        const listEl = document.getElementById('lobby-players-list');
        const countEl = document.getElementById('player-count');
        const state = getState();
        
        if (countEl) countEl.innerText = players.length.toString();
        if (!listEl) return;

        const sortedPlayers = [...players].sort((a, b) => {
            const aIsMe = a.playerUUID === state.playerUUID;
            const bIsMe = b.playerUUID === state.playerUUID;
            if (aIsMe) return -1;
            if (bIsMe) return 1;
            return 0;
        });

        listEl.innerHTML = sortedPlayers.map(p => {
            const isMe = p.playerUUID === state.playerUUID;
            return `
                <li class="pixel-list-item ${isMe ? 'own-player' : ''}">
                    <span class="player-dot alive"></span>
                    ${isMe 
                        ? `<input type="text" id="my-name-input" class="pixel-input name-edit-input" 
                              value="${p.displayName || ''}" 
                              placeholder="Type in your name..." 
                              style="margin-bottom: 0; padding: 4px; font-size: 1rem; width: auto; flex-grow: 1; text-align: left;">` 
                        : `<span>${p.displayName || 'Unnamed Player'}</span>`
                    }
                </li>
            `;
        }).join('');

        const nameInput = document.getElementById('my-name-input') as HTMLInputElement;
        if (nameInput) {
            // Keep focus if we are typing and list re-renders
            nameInput.addEventListener('change', (e) => {
                const newName = (e.target as HTMLInputElement).value.trim();
                if (state.playerUUID) socketService.changeName(state.playerUUID, newName);
            });
        }
    }
}
