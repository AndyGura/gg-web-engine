export interface GgVisualScene<D, R> {

  readonly factory: any; // type defined in sub-interfaces

  init(): Promise<void>;

  dispose(): void;

}
