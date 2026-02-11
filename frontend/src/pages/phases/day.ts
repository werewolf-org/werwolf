import type { View } from '../../router';
import dayHtml from './day.html?raw';
import { getState, setState, subscribeSelector } from '../../store';
import { socketService } from '../../socket.service';

export class DayPhase implements View {
    private container: HTMLElement | null = null;
    private selectedTargetUUID: string | null = null;
    private hasVoted: boolean = false;
    private hasConfirmedNight: boolean = false;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = dayHtml;

        // Switch to Light Mode for Day
        document.body.classList.add('light-mode');

        this.setupVotingView();
        
        // Listen for results
        subscribeSelector(s => s.voteResults, (results) => {
            if (results) this.showResultView();
        });

        // Initial check if we mounted late (results already in)
        if (getState().voteResults) {
            this.showResultView();
        } else {
            this.setupVotingLogic();
        }
    }

    private setupVotingView() {
        const state = getState();
        const me = state.players.find(p => p.playerUUID === state.playerUUID);
        
        // If I am dead, I cannot vote
        if (me && !me.isAlive) {
            this.hasVoted = true; 
            const controls = document.querySelector('#day-voting-view .manager-controls') as HTMLElement;
            if (controls) controls.style.display = 'none';
            const waitingMsg = document.getElementById('vote-confirmed-message');
            if (waitingMsg) {
                waitingMsg.style.display = 'block';
                waitingMsg.innerHTML = '<p class="fog-text">The dead cannot vote. Observe the village...</p>';
            }
        }

        this.renderPlayerList();
    }

    private setupVotingLogic() {
        const confirmBtn = document.getElementById('confirm-vote-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (this.selectedTargetUUID && !this.hasVoted) {
                    socketService.vote(this.selectedTargetUUID);
                    this.hasVoted = true;
                    this.updateVotingUIState();
                }
            });
        }
    }

    private updateVotingUIState() {
        const controls = document.querySelector('#day-voting-view .manager-controls') as HTMLElement;
        const waitingMsg = document.getElementById('vote-confirmed-message');
        const listEl = document.getElementById('day-vote-list');

        if (this.hasVoted) {
            if (controls) controls.style.display = 'none';
            if (waitingMsg) waitingMsg.style.display = 'block';
            if (listEl) {
                listEl.style.pointerEvents = 'none';
                listEl.style.opacity = '0.7';
            }
        }
    }

    private renderPlayerList() {
        const listEl = document.getElementById('day-vote-list');
        if (!listEl) return;

        const state = getState();
        const players = state.players.filter(p => p.isAlive);
        
        listEl.innerHTML = players.map(p => {
            const isMe = p.playerUUID === state.playerUUID;
            return `
                <li class="pixel-list-item selectable-player" data-uuid="${p.playerUUID}">
                    <span class="player-dot alive"></span>
                    <span class="player-name">${p.displayName}${isMe ? ' (You)' : ''}</span>
                </li>
            `;
        }).join('');

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
                const confirmBtn = document.getElementById('confirm-vote-btn') as HTMLButtonElement;
                if (confirmBtn) confirmBtn.disabled = false;
            });
        });
    }

    // --- RESULT VIEW LOGIC ---

    private showResultView() {
        const votingView = document.getElementById('day-voting-view');
        const resultView = document.getElementById('day-result-view');
        if (votingView) votingView.style.display = 'none';
        if (resultView) resultView.style.display = 'block';

        this.renderResultData();

        const state = getState();
        const me = state.players.find(p => p.playerUUID === state.playerUUID);
        const isDead = me && !me.isAlive;

        const controls = document.querySelector('#day-result-view .manager-controls') as HTMLElement;
        const waitingMsg = document.getElementById('night-waiting-message');

        if (isDead) {
            if (controls) controls.style.display = 'none';
            if (waitingMsg) {
                waitingMsg.style.display = 'block';
                waitingMsg.innerHTML = '<p class="fog-text">The dead have no say in the coming night. Waiting for the living...</p>';
            }
            return;
        }

        const readyBtn = document.getElementById('ready-for-night-btn');
        if (readyBtn) {
            // Remove old listeners
            const newBtn = readyBtn.cloneNode(true);
            readyBtn.parentNode?.replaceChild(newBtn, readyBtn);

            newBtn.addEventListener('click', () => {
                if (!this.hasConfirmedNight) {
                    this.hasConfirmedNight = true;
                    socketService.readyForNight();
                    
                    // UI Feedback
                    if (controls) controls.style.display = 'none';
                    if (waitingMsg) waitingMsg.style.display = 'block';
                }
            });
        }
    }

    private renderResultData() {
        const state = getState();
        const votes = state.voteResults;
        const lynchedUUID = state.votedOutUUID;
        const players = state.players; // Note: This list might already have updated 'isAlive' status if backend sent updatePlayers

        // 1. Show Lynched Player
        const lynchedNameEl = document.getElementById('lynched-player-name');
        const lynchTextEl = document.getElementById('lynch-result-text');
        
        if (lynchedUUID) {
            const victim = players.find(p => p.playerUUID === lynchedUUID);
            if (lynchedNameEl) lynchedNameEl.innerText = victim ? victim.displayName : 'Unknown';
            if (lynchTextEl) lynchTextEl.innerText = '...was sent to the gallows.';
        } else {
            if (lynchedNameEl) {
                lynchedNameEl.innerText = "No One";
                lynchedNameEl.style.color = 'var(--text-main)';
            }
            if (lynchTextEl) lynchTextEl.innerText = '...was harmed this day.';
        }

        // 2. Show Vote Breakdown
        const breakdownEl = document.getElementById('day-vote-breakdown');
        if (!breakdownEl || !votes) return;

        // Group votes by Target
        // Structure of votes: Record<voterUUID, targetUUID>
        const votesByTarget: Record<string, string[]> = {};
        
        Object.entries(votes).forEach(([voterUUID, targetUUID]) => {
            // targetUUID can be null (abstained/invalid), TS needs check. In JSON/Record values are explicit.
            // But we cast to string in the next check anyway or verify existence.
            if (!targetUUID) return;
            
            if (!votesByTarget[targetUUID]) votesByTarget[targetUUID] = [];
            
            const voter = players.find(p => p.playerUUID === voterUUID);
            votesByTarget[targetUUID].push(voter ? voter.displayName : 'Unknown');
        });

        // Sort by number of votes
        const sortedTargets = Object.entries(votesByTarget).sort((a, b) => b[1].length - a[1].length);

        breakdownEl.innerHTML = sortedTargets.map(([targetUUID, voterNames]) => {
            const target = players.find(p => p.playerUUID === targetUUID);
            const targetName = target ? target.displayName : 'Unknown';
            const isDead = targetUUID === lynchedUUID;

            return `
                <li class="pixel-list-item" style="flex-direction: column; align-items: flex-start;">
                    <div style="width: 100%; display: flex; justify-content: space-between;">
                        <span style="${isDead ? 'color: var(--accent); text-decoration: line-through;' : ''}">
                            ${targetName}
                        </span>
                        <span class="highlight-text">${voterNames.length} Votes</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                        ${voterNames.join(', ')}
                    </div>
                </li>
            `;
        }).join('');
    }
}