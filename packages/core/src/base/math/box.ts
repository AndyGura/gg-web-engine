import { GgBox } from '../models/geometry-nodes';

export class Box {
  static clone<T>(box: GgBox<T>): GgBox<T> {
    return { min: {...box.min}, max: {...box.max} };
  }
  static expandByPoint<T>(box: GgBox<T>, point: T): GgBox<T> {
    const res: GgBox<T> = Box.clone(box);
    for (const c in point) {
      if (res.min[c] > point[c]) {
        res.min[c] = point[c];
      }
      if (res.max[c] < point[c]) {
        res.max[c] = point[c];
      }
    }
    return res;
  }
}
