import type { View } from '../../router';

export class PlaceholderPhase implements View {
    private phaseName: string;

    constructor(phaseName: string) {
        this.phaseName = phaseName;
    }

    mount(container: HTMLElement): void {
        container.innerHTML = `
            <div class="phase-view placeholder">
                <h3>Phase: ${this.phaseName}</h3>
                <p>This phase is not yet implemented.</p>
            </div>
        `;
    }

}
