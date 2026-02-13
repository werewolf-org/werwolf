import startHtml from './start.html?raw'
import { socketService } from '../socket.service';
import type { View } from '../router';
import { audioService } from '../audio.service';

export class StartPage implements View {
  private container: HTMLElement | null = null;
  private createBtn: HTMLButtonElement | null = null;

  mount(container: HTMLElement): void {
    // Ensure we start in Dark Mode
    document.body.classList.remove('light-mode');

    // Stop any leftover narration when returning to start
    audioService.stopAllNarration();

    this.container = container;
    this.container.innerHTML = startHtml;

    this.createBtn = document.getElementById("create-game") as HTMLButtonElement;

    if (this.createBtn) {
      this.createBtn.addEventListener("click", this.handleCreateGame);
    }
  }

  private handleCreateGame = () => {
    socketService.createGame();
  }
}
