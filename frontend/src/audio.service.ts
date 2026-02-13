import { getState } from './store';

export class AudioService {
    private static instance: AudioService;
    
    private narrationAudio: HTMLAudioElement = new Audio();
    private atmosphereAudio: HTMLAudioElement = new Audio();
    
    private narrationQueue: string[] = [];
    private isNarrationPlaying: boolean = false;
    private lastPlayedPath: string | null = null;
    
    private readonly ATMOSPHERE_NORMAL_VOL = 0.5;
    private readonly ATMOSPHERE_DUCKED_VOL = 0.3;
    private readonly NARRATION_BREAK_SEC = 1.0;

    private constructor() {
        this.atmosphereAudio.loop = true;
        this.atmosphereAudio.volume = this.ATMOSPHERE_NORMAL_VOL;
        
        this.narrationAudio.onended = () => this.handleNarrationEnded();
    }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    /**
     * Play a narration file from /narration/*.mp3
     * Only plays if the current player is the Manager.
     * @param fileName Name without extension
     * @param mode 'overwrite' stops current and clears queue. 'stack' adds to queue.
     */
    public playNarration(fileName: string, mode: 'stack' | 'overwrite' = 'stack'): void {
        const state = getState();
        if (!state.isManager) return;

        const path = `/narration/${fileName}.mp3`;

        // Prevent immediate duplicate queuing of the same file
        // Also check lastPlayedPath to handle the "break" period after a sound ends
        const isCurrentlyPlaying = this.isNarrationPlaying && this.narrationAudio.src.endsWith(path);
        const isLastInQueue = this.narrationQueue.length > 0 && this.narrationQueue[this.narrationQueue.length - 1] === path;
        const isJustFinished = !this.isNarrationPlaying && this.lastPlayedPath === path;
        
        if (mode === 'stack' && (isCurrentlyPlaying || isLastInQueue || isJustFinished)) {
            return;
        }

        if (mode === 'overwrite') {
            this.stopAllNarration();
            this.narrationQueue.push(path);
            this.processQueue();
        } else {
            this.narrationQueue.push(path);
            if (!this.isNarrationPlaying) {
                this.processQueue();
            }
        }
    }

    /**
     * Stops all current narration and clears the queue.
     */
    public stopAllNarration(): void {
        this.narrationQueue = [];
        this.stopCurrentAudio();
        this.lastPlayedPath = null;
        this.duckAtmosphere(false);
    }

    /**
     * Set the looping background atmosphere from /sounds/*.mp3
     */
    public setAtmosphere(fileName: string): void {
        const path = `/sounds/${fileName}.mp3`;
        if (this.atmosphereAudio.src.includes(path)) return;

        this.atmosphereAudio.src = path;
        this.atmosphereAudio.play().catch(e => console.warn("Atmosphere autoplay blocked:", e));
    }

    /**
     * Play a one-off sound effect from /sounds/*.mp3
     */
    public playSFX(fileName: string): void {
        const sfx = new Audio(`/sounds/${fileName}.mp3`);
        sfx.volume = 0.8;
        sfx.play();
    }

    private processQueue(): void {
        if (this.narrationQueue.length === 0) return;

        const nextSrc = this.narrationQueue.shift();
        if (nextSrc) {
            this.narrationAudio.src = nextSrc;
            this.lastPlayedPath = nextSrc;
            this.isNarrationPlaying = true;
            this.duckAtmosphere(true);
            this.narrationAudio.play().catch(e => console.warn("Narration autoplay blocked:", e));
        }
    }

    private handleNarrationEnded(): void {
        this.isNarrationPlaying = false;
        if (this.narrationQueue.length > 0) {
            // Add a short pause before the next narration
            setTimeout(() => {
                // Check again if a new 'overwrite' hasn't cleared the queue in the meantime
                if (this.narrationQueue.length > 0 && !this.isNarrationPlaying) {
                    this.processQueue();
                }
            }, this.NARRATION_BREAK_SEC * 1000);
        } else {
            this.duckAtmosphere(false);
        }
    }

    private stopCurrentAudio(): void {
        this.narrationAudio.pause();
        this.narrationAudio.currentTime = 0;
        this.isNarrationPlaying = false;
    }

    private duckAtmosphere(duck: boolean): void {
        this.atmosphereAudio.volume = duck ? this.ATMOSPHERE_DUCKED_VOL : this.ATMOSPHERE_NORMAL_VOL;
    }
}

export const audioService = AudioService.getInstance();
