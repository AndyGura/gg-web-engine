import { VisualTypeDocRepo2D } from '../../gg-2d-world';
import { IDisplayObject2dComponent } from './i-display-object-2d.component';
import { Text2dStyle } from '../../models/text';

/**
 * A display object that draws a string, created with `IDisplayObject2dComponentFactory.createText`.
 * Wrap it in an `Entity2d` to place it in a world, like any other display object.
 */
export interface IText2dComponent<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IDisplayObject2dComponent<VTypeDoc> {
  /** The displayed string. `\n` starts a new line. */
  text: string;

  /** The current style, with every field the adapter resolved. */
  readonly style: Text2dStyle;

  /** Changes the given style fields and keeps the rest. */
  setStyle(style: Text2dStyle): void;
}
