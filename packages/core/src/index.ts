import { VERSION } from './version';
import { registerCoreVersion } from './base/setup-errors';
(window as any).gg_version = VERSION;
registerCoreVersion(VERSION);

export * from './base';
export * from './2d';
export * from './3d';
export * from './dev';
export { VERSION };
