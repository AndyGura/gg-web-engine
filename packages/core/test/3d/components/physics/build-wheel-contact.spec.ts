import { buildWheelContact, Pnt3, Qtrn } from '../../../../src';

describe('buildWheelContact', () => {
  const flat = {
    point: { x: 1, y: 2, z: 0 },
    normal: Pnt3.Z,
    steering: 0,
    chassisRotation: Qtrn.O,
    linearVelocity: Pnt3.O,
    angularVelocity: Pnt3.O,
    centerOfMass: { x: 1, y: 2, z: 0.5 },
    suspensionForce: 2000,
    maxSuspensionForce: 5000,
    skid: 1,
  };

  it('steers the chassis +X axle about the chassis up axis', () => {
    const { axle } = buildWheelContact({ ...flat, steering: 0.3 });
    expect(axle.x).toBeCloseTo(Math.cos(0.3), 9);
    expect(axle.y).toBeCloseTo(Math.sin(0.3), 9);
    expect(axle.z).toBeCloseTo(0, 9);
  });

  it('lays the axle into the ground plane of a rolled chassis', () => {
    const { axle } = buildWheelContact({ ...flat, chassisRotation: Qtrn.rotAround(Qtrn.O, Pnt3.Y, 0.2) });
    expect(axle.z).toBeCloseTo(0, 9);
    expect(Pnt3.len(axle)).toBeCloseTo(1, 9);
  });

  it('keeps the axle in the ground plane when it points along the normal', () => {
    // a car on its side, the wheel's ray hitting a wall in front of its axle, the chassis moving
    // toward the wall
    const contact = buildWheelContact({ ...flat, normal: Pnt3.nX, linearVelocity: { x: 1, y: 0, z: 0 } });
    expect(Pnt3.dot(contact.axle, contact.normal)).toBeCloseTo(0, 9);
    expect(Pnt3.len(contact.axle)).toBeCloseTo(1, 9);
    expect(contact.sideSlipSpeed).toBeCloseTo(0, 9);
  });

  it('leaves the chassis bouncing on its springs out of sideSlipSpeed', () => {
    const contact = buildWheelContact({
      ...flat,
      chassisRotation: Qtrn.rotAround(Qtrn.O, Pnt3.Y, 0.2),
      linearVelocity: { x: 0, y: 0, z: 1 },
    });
    expect(contact.velocity.z).toBeCloseTo(1, 9);
    expect(contact.sideSlipSpeed).toBeCloseTo(0, 9);
  });

  it('adds the spin about the centre of mass to the contact velocity', () => {
    // rolling at 2 rad/s about +Y moves the contact point, 0.5 m below the centre of mass, toward
    // -X at 1 m/s
    const contact = buildWheelContact({ ...flat, angularVelocity: { x: 0, y: 2, z: 0 } });
    expect(contact.velocity.x).toBeCloseTo(-1, 9);
    expect(contact.sideSlipSpeed).toBeCloseTo(-1, 9);
  });

  it('clamps the suspension force to what the engine applies', () => {
    expect(buildWheelContact({ ...flat, suspensionForce: 9000 }).suspensionForce).toBe(5000);
    expect(buildWheelContact({ ...flat, suspensionForce: -10 }).suspensionForce).toBe(0);
  });
});
