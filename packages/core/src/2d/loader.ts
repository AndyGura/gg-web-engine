import { Gg2dWorld, Gg2dWorldTypeDocRepo } from './gg-2d-world';


export class Gg2dLoader<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> {

  constructor(protected readonly world: Gg2dWorld<TypeDoc>) {}

}
