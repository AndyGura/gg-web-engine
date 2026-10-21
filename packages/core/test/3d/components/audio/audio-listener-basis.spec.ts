import {
  AUDIO_LISTENER_AXES,
  Camera3dEntity,
  defaultAudioListenerBasis,
  Entity3d,
  ICamera3dComponent,
  IPositionable,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
} from '../../../../src';

describe('AudioListenerBasis', () => {
  it("picks 'camera' for a Camera3dEntity", () => {
    const camera = new Camera3dEntity({ position: Pnt3.O, rotation: Qtrn.O, fov: 60 } as unknown as ICamera3dComponent);
    expect(defaultAudioListenerBasis(camera)).toBe('camera');
  });

  it("picks 'camera' for a bare camera component", () => {
    const component = { position: Pnt3.O, rotation: Qtrn.O, fov: 60 } as unknown as IPositionable<Point3, Point4>;
    expect(defaultAudioListenerBasis(component)).toBe('camera');
  });

  it("picks 'body' for any other positionable", () => {
    expect(defaultAudioListenerBasis(new Entity3d({}))).toBe('body');
    expect(defaultAudioListenerBasis({ position: Pnt3.O, rotation: Qtrn.O } as IPositionable<Point3, Point4>)).toBe(
      'body',
    );
  });

  it('keeps every basis right-handed and perpendicular', () => {
    for (const { forward, up } of Object.values(AUDIO_LISTENER_AXES)) {
      expect(Pnt3.dot(forward, up)).toBe(0);
      expect(Pnt3.len(Pnt3.cross(forward, up))).toBe(1);
    }
  });
});
