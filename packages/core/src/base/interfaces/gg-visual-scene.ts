export interface GgVisualScene<D, R> {

  init(): Promise<void>;

  dispose(): void;

}
