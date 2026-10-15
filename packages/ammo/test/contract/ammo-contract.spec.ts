import { describePhysics3dContract } from '../../../core/test/contract/physics-3d.contract';
import { AmmoWorldComponent } from '../../src';

describePhysics3dContract('ammo', () => new AmmoWorldComponent());
