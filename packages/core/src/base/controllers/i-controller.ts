export interface IController {
  start(): Promise<void>;

  stop(): Promise<void>;
}
