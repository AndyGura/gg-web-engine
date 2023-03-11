import {BodyShape2DDescriptor, Shape2DDescriptor} from "./models/shapes";
import {Point2} from "../base/models/points";
import {IGg2dBody, IGg2dObject, IGg2dTrigger} from "./interfaces";


export abstract class IGg2dObjectFactory<T extends IGg2dObject = IGg2dObject> {
    abstract createPrimitive(descriptor: Shape2DDescriptor): T;

    // shortcuts
    createSquare(dimensions: Point2): T {
        return this.createPrimitive({ shape: 'SQUARE', dimensions });
    };
    createCircle(radius: number): T {
        return this.createPrimitive({ shape: 'CIRCLE', radius });
    };
}

export interface IGg2dBodyFactory<T extends IGg2dBody = IGg2dBody, K extends IGg2dTrigger = IGg2dTrigger> {
    createRigidBody(descriptor: BodyShape2DDescriptor, transform?: { position?: Point2, rotation?: number;}): T;
    createTrigger(descriptor: Shape2DDescriptor, transform?: { position?: Point2, rotation?: number;}): K;
}