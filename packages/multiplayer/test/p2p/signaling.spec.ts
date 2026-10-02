import { IEntity } from '@gg-web-engine/core';
import { DEFAULT_FIREBASE_CONFIG, FirebaseSignaling, PresenceEntry, SdpOrIce, WebRtcMeshTransport } from '../../src';
import { fakeFirebase } from '../stubs/firebase';
import { FakeRTCPeerConnection, settle } from './fakes';
import { ADAPTERS, TICK_MS } from '../harness/harness';
import { Network3dController, VirtualScheduler } from '../../src';

const config = { apiKey: 'k', projectId: 'p', databaseURL: 'https://p.firebaseio.com' };

describe('FirebaseSignaling', () => {
  beforeEach(() => fakeFirebase.reset());

  it('uses DEFAULT_FIREBASE_CONFIG when no config is passed', () => {
    new FirebaseSignaling();
    expect(fakeFirebase.state.apps.map(app => app.options)).toEqual([DEFAULT_FIREBASE_CONFIG]);
  });

  it('creates a room, tracks presence and cells, relays signals and cleans its inbox', async () => {
    const uidA = fakeFirebase.asNewClient();
    const a = new FirebaseSignaling({ config });
    const roomId = await a.createRoom();
    expect(fakeFirebase.read(`gg-rooms/${roomId}/meta`)).toEqual({ createdAt: 12345, uid: uidA });
    await a.join(roomId, 'peerA');
    fakeFirebase.asNewClient();
    const b = new FirebaseSignaling({ config });
    await b.join(roomId, 'peerB');
    let presence: ReadonlyArray<PresenceEntry> = [];
    a.presence$.subscribe(p => (presence = p));
    await settle();
    expect(presence.map(p => p.peerId).sort()).toEqual(['peerA', 'peerB']);

    await b.setCell('3:4');
    await settle();
    expect(presence.find(p => p.peerId === 'peerB')!.cell).toBe('3:4');

    const received: { from: string; payload: SdpOrIce }[] = [];
    a.incoming$.subscribe(m => received.push(m));
    await b.publish('peerA', { kind: 'offer', sdp: 'v=0' });
    await settle();
    expect(received).toEqual([{ from: 'peerB', payload: { kind: 'offer', sdp: 'v=0' } }]);
    expect(fakeFirebase.read(`gg-rooms/${roomId}/signals/peerA`)).toBeNull(); // consumed

    await b.leave();
    await settle();
    expect(presence.map(p => p.peerId)).toEqual(['peerA']);
  });

  it('registers onDisconnect removal of everything a peer writes', async () => {
    const uid = fakeFirebase.asNewClient();
    const a = new FirebaseSignaling({ config });
    const roomId = await a.createRoom();
    await a.join(roomId, 'peerA');
    await a.publish('peerX', { kind: 'ice', candidate: null });
    fakeFirebase.disconnect(uid); // tab closed without leave()
    expect(fakeFirebase.read(`gg-rooms/${roomId}`)).toBeNull();
  });
});

describe('NetworkController over WebRtcMeshTransport (fake WebRTC, fake Firebase)', () => {
  beforeEach(() => fakeFirebase.reset());

  it('joins a room and replicates a runtime spawn', async () => {
    const adapter = ADAPTERS.find(a => a.name === 'rapier3d')!;
    const scheduler = new VirtualScheduler(1000);
    const peers: { world: any; net: Network3dController }[] = [];
    const add = async (id: string, roomId: string) => {
      fakeFirebase.asNewClient();
      const world = await adapter.createWorld();
      adapter.addGround(world);
      const transport = new WebRtcMeshTransport({
        signaling: new FirebaseSignaling({ config }),
        roomId,
        localPeerId: id,
        rtcPeerConnection: FakeRTCPeerConnection as any,
        scheduler,
      });
      const net = new Network3dController({ transport, scheduler, prefixEntityNames: false });
      world.addEntity(net);
      peers.push({ world, net });
      let done = false;
      net.connect().then(() => (done = true));
      for (let i = 0; i < 500 && !done; i++) {
        await settle(5);
        scheduler.advance(TICK_MS);
        await new Promise(r => setTimeout(r, 0));
      }
      expect(done).toBe(true);
      return { world, net };
    };
    const roomId = await new FirebaseSignaling({ config }).createRoom();
    const a = await add('a', roomId);
    const b = await add('b', roomId);
    expect(a.net.peerInfos.map(p => p.peerId)).toEqual(['b']);
    const box = adapter.addBox(a.world, adapter.at(0, 2));
    for (let i = 0; i < 60; i++) {
      scheduler.advance(TICK_MS);
      for (const p of peers) {
        p.world.worldClock.step(TICK_MS);
      }
      await settle(5);
    }
    await new Promise(r => setTimeout(r, 0));
    const replica = b.world.children.find((e: IEntity) => e.name === box.name);
    expect(replica).toBeDefined();
    expect(b.net.ownerOf(replica!)).toBe('a');
    peers.forEach(p => p.world.dispose());
  });
});
