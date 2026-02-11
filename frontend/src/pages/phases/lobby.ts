import type { View } from '../../router';
import lobbyHtml from './lobby.html?raw';
import { subscribeSelector, getState, setState } from '../../store';
import QRCode from 'qrcode';
import { socketService } from '../../socket.service';

export class LobbyPhase implements View {
    private container: HTMLElement | null = null;

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

        // 2. Subscribe to Players List
        subscribeSelector(s => s.players, (players) => {
            this.updatePlayerList(players);
        })

        // 3. Subscribe to Manager status
        subscribeSelector(s => s.isManager, (isManager) => {
            const controls = document.getElementById('manager-controls');
            const waitingMsg = document.getElementById('player-waiting-message');
            
            if (controls) controls.style.display = isManager ? 'block' : 'none';
            if (waitingMsg) waitingMsg.style.display = isManager ? 'none' : 'block';
        })

        // Initial render
        this.updatePlayerList(state.players);
        const controls = document.getElementById('manager-controls');
        const waitingMsg = document.getElementById('player-waiting-message');
        if (controls) controls.style.display = state.isManager ? 'block' : 'none';
        if (waitingMsg) waitingMsg.style.display = state.isManager ? 'none' : 'block';

        // 4. Setup Action Listeners
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.nameUnnamedPlayers();
                socketService.closeJoining();
            });
        }
    }

    private nameUnnamedPlayers() {
        const players = getState().players;
        let i = 0;
        players.forEach((player) => {
            if(player.displayName === '') socketService.changeName(player.playerUUID, `Unnamed Player ${i++}`);
        })
    }

    private async generateQRCode(url: string, container: HTMLElement) {
        try {
            // Get theme colors from CSS variables
            const style = getComputedStyle(document.documentElement);
            const colorLight = style.getPropertyValue('--card-bg').trim() || '#1a1c29';

            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, url, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#ffffff',   // Foreground is now always white
                    light: colorLight  // Background matches card
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
        const currentState = getState();
        
        if (countEl) countEl.innerText = players.length.toString();
        if (!listEl) return;

        // Sort players: Put "Me" at the top
        const sortedPlayers = [...players].sort((a, b) => {
            const aIsMe = currentState.playerUUID && a.playerUUID === currentState.playerUUID;
            const bIsMe = currentState.playerUUID && b.playerUUID === currentState.playerUUID;
            if (aIsMe) return -1;
            if (bIsMe) return 1;
            return 0;
        });

        listEl.innerHTML = sortedPlayers.map(p => {
            const isMe = currentState.playerUUID && p.playerUUID === currentState.playerUUID;
            return `
                <li class="pixel-list-item ${isMe ? 'own-player' : ''}">
                    <span class="player-dot ${p.isAlive ? 'alive' : 'dead'}"></span>
                    ${isMe 
                        ? `<input type="text" class="pixel-input name-edit-input" 
                              value="${p.displayName || ''}" 
                              placeholder="Type in your name..." 
                              style="margin-bottom: 0; padding: 4px; font-size: 1rem; width: auto; flex-grow: 1; text-align: left;">` 
                        : `<span>${p.displayName || 'Unnamed Player'}</span>`
                    }
                </li>
            `;
        }).join('');

        // Add listeners for name changes
        const nameInput = listEl.querySelector('.name-edit-input') as HTMLInputElement;
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                const newName = (e.target as HTMLInputElement).value.trim();
                setState({displayName: newName});
                const playerUUID = getState().playerUUID
                if(playerUUID) socketService.changeName(playerUUID, newName);
            });
        }
    }
}
