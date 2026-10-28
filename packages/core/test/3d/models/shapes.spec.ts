import { shapeContains, shapeHasMesh, warnIfMeshTrigger } from '../../../src';

describe('trigger MESH shape check', () => {
  const mesh = { shape: 'MESH' as const, vertices: [], faces: [] };
  const box = { shape: 'BOX' as const, dimensions: { x: 1, y: 1, z: 1 } };

  it('finds a MESH at the top level or anywhere in a COMPOUND', () => {
    expect(shapeHasMesh(mesh)).toBe(true);
    expect(shapeHasMesh(box)).toBe(false);
    expect(shapeHasMesh({ shape: 'COMPOUND', children: [{ shape: box }] })).toBe(false);
    expect(
      shapeHasMesh({
        shape: 'COMPOUND',
        children: [{ shape: box }, { shape: { shape: 'COMPOUND', children: [{ shape: mesh }] } }],
      }),
    ).toBe(true);
  });

  it('finds any of several shape kinds, nested in COMPOUNDs too', () => {
    const plane = { shape: 'PLANE' as const };
    expect(shapeContains(plane, ['MESH', 'PLANE'])).toBe(true);
    expect(shapeContains(box, ['MESH', 'PLANE'])).toBe(false);
    expect(
      shapeContains({ shape: 'COMPOUND', children: [{ shape: { shape: 'COMPOUND', children: [{ shape: plane }] } }] }, [
        'MESH',
        'PLANE',
      ]),
    ).toBe(true);
  });

  it('warns once for a MESH trigger and never for a convex one', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfMeshTrigger(box);
    expect(warn).not.toHaveBeenCalled();
    warnIfMeshTrigger(mesh);
    warnIfMeshTrigger({ shape: 'COMPOUND', children: [{ shape: mesh }] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('CONVEX_HULL');
    warn.mockRestore();
  });
});
