import { View } from '../../base-view';

export class PlaceholderPhase extends View {
    private phaseName: string;

    constructor(phaseName: string) {
        super();
        this.phaseName = phaseName;
    }

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="phase-view placeholder">
                <h3>Phase: ${this.phaseName}</h3>
                <p>This phase is not yet implemented.</p>
            </div>
        `;
    }
}
