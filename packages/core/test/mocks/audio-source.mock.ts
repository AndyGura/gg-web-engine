import { Subject } from 'rxjs';
import { IAudioSource2dComponent, IAudioSource3dComponent, Pnt2, Pnt3, Qtrn } from '../../src';

export const mock3DAudioSource = (): IAudioSource3dComponent => {
  return {
    position: Pnt3.O,
    rotation: Qtrn.O,
    loop: false,
    volume: 1,
    playbackRate: 1,
    spatial: true,
    bus: 'sfx',
    isPlaying: false,
    ended$: new Subject<void>().asObservable(),
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    distanceModel: 'linear',
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    addToWorld: jest.fn(),
    removeFromWorld: jest.fn(),
    dispose: jest.fn(),
    clone: () => mock3DAudioSource(),
  } as unknown as IAudioSource3dComponent;
};

export const mock2DAudioSource = (): IAudioSource2dComponent => {
  return {
    position: Pnt2.O,
    rotation: 0,
    loop: false,
    volume: 1,
    playbackRate: 1,
    spatial: true,
    bus: 'sfx',
    isPlaying: false,
    ended$: new Subject<void>().asObservable(),
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    distanceModel: 'linear',
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    addToWorld: jest.fn(),
    removeFromWorld: jest.fn(),
    dispose: jest.fn(),
    clone: () => mock2DAudioSource(),
  } as unknown as IAudioSource2dComponent;
};
