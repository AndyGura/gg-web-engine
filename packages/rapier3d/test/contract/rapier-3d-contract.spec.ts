import { describePhysics3dContract } from '../../../core/test/contract/physics-3d.contract';
import { Rapier3dWorldComponent } from '../../src';

describePhysics3dContract('rapier3d', () => new Rapier3dWorldComponent(), { unsupportedShapes: ['PLANE'] });
