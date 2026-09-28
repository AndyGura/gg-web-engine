import { IDisplayObject2dComponent } from './i-display-object-2d.component';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';
import { DisplayObject2dOpts } from '../../factories';

/**
 * 2D counterpart of `IMaterialReadable3dComponent` - a display object that remembers the
 * `DisplayObject2dOpts` (`color`/`texture`) it was actually built with, e.g. one of
 * `IDisplayObject2dComponentFactory.createPrimitive`'s own outputs. Optional/adapter-specific on
 * purpose - check with {@link isMaterialReadable2d} before reading {@link materialOptions}.
 */
export interface IMaterialReadable2dComponent<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IDisplayObject2dComponent<VTypeDoc> {
  /** The options this display object was actually constructed with - see the 3D counterpart's own
   * doc for the exact contract (resolved, not necessarily a verbatim echo of the caller's input). */
  readonly materialOptions: DisplayObject2dOpts<VTypeDoc['texture']>;
}

/**
 * Type guard for {@link IMaterialReadable2dComponent} - see the 3D counterpart's own doc for why
 * this shape (a field check, not `instanceof`) is used.
 */
export function isMaterialReadable2d<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>(
  displayObject: VTypeDoc['displayObject'] | null | undefined,
): displayObject is IMaterialReadable2dComponent<VTypeDoc> {
  return (
    !!displayObject &&
    typeof (displayObject as Partial<IMaterialReadable2dComponent<VTypeDoc>>).materialOptions === 'object'
  );
}
