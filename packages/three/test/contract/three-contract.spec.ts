import { describeVisual3dContract } from '../../../core/test/contract/visual-3d.contract';
import { ThreeFactory } from '../../src';

describeVisual3dContract('three', () => new ThreeFactory(), { unsupportedShapes: ['CONVEX_HULL'] });
