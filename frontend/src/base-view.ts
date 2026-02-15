export abstract class View {
  protected container: HTMLElement | null = null;
  protected subs: (() => void)[] = [];

  abstract mount(container: HTMLElement): void;

  unmount(): void {
    this.subs.forEach(unsub => unsub());
    this.subs = [];
    this.container = null;
  }
}
