import { describePhysics2dContract } from '../../../core/test/contract/physics-2d.contract';
import { MatterWorldComponent } from '../../src';

describePhysics2dContract('matter', () => new MatterWorldComponent());
