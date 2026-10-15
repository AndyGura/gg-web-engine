import { describePhysics2dContract } from '../../../core/test/contract/physics-2d.contract';
import { Rapier2dWorldComponent } from '../../src';

describePhysics2dContract('rapier2d', () => new Rapier2dWorldComponent());
