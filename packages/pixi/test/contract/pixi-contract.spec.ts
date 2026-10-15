import { describeVisual2dContract } from '../../../core/test/contract/visual-2d.contract';
import { PixiFactory } from '../../src';

describeVisual2dContract('pixi', () => new PixiFactory());
