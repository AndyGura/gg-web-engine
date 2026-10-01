import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  Database,
  DatabaseReference,
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ISignalingChannel, PresenceEntry, SdpOrIce } from './signaling';
import { generateRoomId } from './room-url';

/**
 * The engine maintainer's Firebase project, used when no `config` is passed. `null` until the
 * maintainer fills in the project's public web config (project id, database URL, API key - these are
 * public identifiers, not secrets; access is governed by the database rules documented in the
 * package README). Pass your own `config` to run against your own project.
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseOptions | null = null;

export interface FirebaseSignalingOptions {
  /** Firebase web config; defaults to {@link DEFAULT_FIREBASE_CONFIG} */
  config?: FirebaseOptions;
  /** reuse an already-initialized Firebase app instead of `config` */
  app?: FirebaseApp;
  /** reCAPTCHA v3 site key; when given, App Check is initialized (recommended in production) */
  appCheckSiteKey?: string;
  /** database path all rooms live under. Default `'gg-rooms'`. */
  rootPath?: string;
}

const APP_NAME = 'gg-web-engine-multiplayer';

/**
 * `ISignalingChannel` on Firebase Realtime Database. Every peer signs in anonymously; data layout
 * (all under `rootPath`, default `gg-rooms`):
 *
 * - `{room}/meta` - `{ createdAt, uid }`, written by `createRoom()`, removed when its tab closes
 * - `{room}/presence/{peerId}` - `{ uid, cell, ts }`, one per peer in the room (`ts` refreshed every 2 minutes)
 * - `{room}/signals/{toPeerId}/{pushId}` - `{ uid, from, payload, ts }`, an SDP/ICE message;
 *   the recipient deletes each one as it reads it
 *
 * Every node a peer writes is registered with `onDisconnect().remove()`, so nothing depends on a
 * Cloud Function in the common case; a scheduled function sweeping nodes older than 10 minutes is the
 * backstop for the rest. The rules the client relies on (anonymous auth, per-uid write scope,
 * shape/size validation) are documented in the package README.
 */
export class FirebaseSignaling implements ISignalingChannel {
  private readonly app: FirebaseApp;
  private readonly db: Database;
  private readonly rootPath: string;
  private uid: string | null = null;
  private roomId: string | null = null;
  private localPeerId: string | null = null;
  private readonly unsubscribers: (() => void)[] = [];
  private presenceRefresh: ReturnType<typeof setInterval> | null = null;
  private readonly pushedSignals: DatabaseReference[] = [];
  private readonly _incoming$ = new Subject<{ from: string; payload: SdpOrIce }>();
  private readonly _presence$ = new BehaviorSubject<ReadonlyArray<PresenceEntry>>([]);

  constructor(options: FirebaseSignalingOptions = {}) {
    if (options.app) {
      this.app = options.app;
    } else {
      const config = options.config ?? DEFAULT_FIREBASE_CONFIG;
      if (!config) {
        throw new Error(
          'FirebaseSignaling: no Firebase config - pass `config` (see the @gg-web-engine/multiplayer README), ' +
            'or use BroadcastChannelSignaling for same-browser local testing',
        );
      }
      this.app = getApps().some(a => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(config, APP_NAME);
    }
    if (options.appCheckSiteKey) {
      initializeAppCheck(this.app, {
        provider: new ReCaptchaV3Provider(options.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    this.db = getDatabase(this.app);
    this.rootPath = options.rootPath ?? 'gg-rooms';
  }

  get incoming$(): Observable<{ from: string; payload: SdpOrIce }> {
    return this._incoming$.asObservable();
  }

  get presence$(): Observable<ReadonlyArray<PresenceEntry>> {
    return this._presence$.asObservable();
  }

  async createRoom(): Promise<string> {
    const uid = await this.signIn();
    const roomId = generateRoomId();
    const metaRef = ref(this.db, `${this.rootPath}/${roomId}/meta`);
    await onDisconnect(metaRef).remove();
    await set(metaRef, { createdAt: serverTimestamp(), uid });
    return roomId;
  }

  async join(roomId: string, localPeerId: string): Promise<void> {
    const uid = await this.signIn();
    this.roomId = roomId;
    this.localPeerId = localPeerId;
    const presenceRef = ref(this.db, `${this.rootPath}/${roomId}/presence/${localPeerId}`);
    await onDisconnect(presenceRef).remove();
    await set(presenceRef, { uid, cell: '', ts: serverTimestamp() });
    // keep `ts` fresh: the backstop sweep removes presence older than 10 minutes
    this.presenceRefresh = setInterval(() => void update(presenceRef, { ts: serverTimestamp() }), 120_000);

    const inboxRef = ref(this.db, `${this.rootPath}/${roomId}/signals/${localPeerId}`);
    await onDisconnect(inboxRef).remove();
    this.unsubscribers.push(
      onChildAdded(inboxRef, snapshot => {
        const value = snapshot.val();
        void remove(snapshot.ref);
        if (!value || typeof value.from !== 'string' || typeof value.payload !== 'string') {
          return;
        }
        try {
          this._incoming$.next({ from: value.from, payload: JSON.parse(value.payload) as SdpOrIce });
        } catch {
          // malformed signal - ignore
        }
      }),
      onValue(ref(this.db, `${this.rootPath}/${roomId}/presence`), snapshot => {
        const entries: PresenceEntry[] = [];
        snapshot.forEach(child => {
          const v = child.val();
          if (child.key) {
            entries.push({ peerId: child.key, cell: typeof v?.cell === 'string' ? v.cell : '' });
          }
        });
        this._presence$.next(entries);
      }),
    );
  }

  async publish(to: string, payload: SdpOrIce): Promise<void> {
    if (!this.roomId || !this.localPeerId || !this.uid) {
      throw new Error('FirebaseSignaling: join a room before publishing');
    }
    const signalRef = push(ref(this.db, `${this.rootPath}/${this.roomId}/signals/${to}`));
    this.pushedSignals.push(signalRef);
    await onDisconnect(signalRef).remove();
    await set(signalRef, {
      uid: this.uid,
      from: this.localPeerId,
      payload: JSON.stringify(payload),
      ts: serverTimestamp(),
    });
  }

  async setCell(cell: string): Promise<void> {
    if (!this.roomId || !this.localPeerId) {
      return;
    }
    await update(ref(this.db, `${this.rootPath}/${this.roomId}/presence/${this.localPeerId}`), { cell });
  }

  async leave(): Promise<void> {
    if (this.presenceRefresh) {
      clearInterval(this.presenceRefresh);
      this.presenceRefresh = null;
    }
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    if (this.roomId && this.localPeerId) {
      const base = `${this.rootPath}/${this.roomId}`;
      await Promise.all([
        remove(ref(this.db, `${base}/presence/${this.localPeerId}`)),
        remove(ref(this.db, `${base}/signals/${this.localPeerId}`)),
        ...this.pushedSignals.map(r => remove(r)),
      ]).catch(() => undefined);
    }
    this.pushedSignals.length = 0;
    this.roomId = null;
    this._presence$.next([]);
  }

  private async signIn(): Promise<string> {
    if (this.uid) {
      return this.uid;
    }
    const auth = getAuth(this.app);
    const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    this.uid = credential.user.uid;
    return this.uid;
  }
}
