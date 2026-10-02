/**
 * In-memory stand-in for the parts of the Firebase modular SDK `FirebaseSignaling` uses (app, auth,
 * app-check, realtime database), mapped over `firebase/*` by the jest config. One shared tree per
 * test file; `fakeFirebase.disconnect(uid)` runs a client's registered `onDisconnect` removals.
 */
type Listener = { path: string; kind: 'value' | 'child_added'; cb: (snap: any) => void; seen: Set<string> };

const state = {
  tree: {} as any,
  listeners: [] as Listener[],
  disconnects: [] as { uid: string; path: string }[],
  currentUid: 'uid-0',
  uidCounter: 0,
  pushCounter: 0,
  apps: [] as any[],
};

export const fakeFirebase = {
  state,
  reset() {
    state.tree = {};
    state.listeners = [];
    state.disconnects = [];
    state.apps = [];
  },
  /** switch the "current client" the next signInAnonymously/onDisconnect calls belong to */
  asNewClient(): string {
    state.currentUid = `uid-${++state.uidCounter}`;
    return state.currentUid;
  },
  disconnect(uid: string) {
    for (const d of state.disconnects.filter(d => d.uid === uid)) {
      writePath(d.path, null);
    }
    state.disconnects = state.disconnects.filter(d => d.uid !== uid);
  },
  read(path: string) {
    return readPath(path);
  },
};

const parts = (path: string) => path.split('/').filter(Boolean);

function readPath(path: string): any {
  let node = state.tree;
  for (const p of parts(path)) {
    if (node == null || typeof node !== 'object') {
      return null;
    }
    node = node[p];
  }
  return node ?? null;
}

function writePath(path: string, value: any): void {
  const ps = parts(path);
  let node = state.tree;
  for (let i = 0; i < ps.length - 1; i++) {
    node[ps[i]] = node[ps[i]] && typeof node[ps[i]] === 'object' ? node[ps[i]] : {};
    node = node[ps[i]];
  }
  const last = ps[ps.length - 1];
  if (value === null) {
    delete node[last];
    prune(state.tree, ps.slice(0, -1));
  } else {
    node[last] = JSON.parse(JSON.stringify(value));
  }
  notify();
}

/** like the real database: a node left without children stops existing */
function prune(root: any, path: string[]): void {
  for (let depth = path.length; depth > 0; depth--) {
    let parent = root;
    for (const p of path.slice(0, depth - 1)) {
      parent = parent?.[p];
    }
    const key = path[depth - 1];
    if (parent && parent[key] && typeof parent[key] === 'object' && Object.keys(parent[key]).length === 0) {
      delete parent[key];
    } else {
      return;
    }
  }
}

function snapshot(path: string, value: any): any {
  return {
    key: parts(path).pop() ?? null,
    ref: { path },
    val: () => (value == null ? null : JSON.parse(JSON.stringify(value))),
    forEach(fn: (child: any) => void) {
      if (value && typeof value === 'object') {
        for (const k of Object.keys(value)) {
          fn(snapshot(`${path}/${k}`, value[k]));
        }
      }
    },
  };
}

function notify(): void {
  for (const l of [...state.listeners]) {
    queueMicrotask(() => {
      if (!state.listeners.includes(l)) {
        return;
      }
      const value = readPath(l.path);
      if (l.kind === 'value') {
        l.cb(snapshot(l.path, value));
      } else if (value && typeof value === 'object') {
        for (const k of Object.keys(value)) {
          if (!l.seen.has(k)) {
            l.seen.add(k);
            l.cb(snapshot(`${l.path}/${k}`, value[k]));
          }
        }
      }
    });
  }
}

// --- firebase/app
export const initializeApp = (options: any, name = '[DEFAULT]') => {
  const app = { name, options };
  state.apps.push(app);
  return app;
};
export const getApps = () => state.apps;
export const getApp = (name = '[DEFAULT]') => state.apps.find(a => a.name === name);

// --- firebase/auth
export const getAuth = () => ({ currentUser: null });
export const signInAnonymously = async () => ({ user: { uid: state.currentUid } });

// --- firebase/app-check
export class ReCaptchaV3Provider {
  constructor(public readonly key: string) {}
}
export const initializeAppCheck = (_app: any, options: any) => ({ options });

// --- firebase/database
export const getDatabase = () => ({});
export const ref = (_db: any, path = '') => ({ path });
export const serverTimestamp = () => 12345;
export const set = async (r: { path: string }, value: any) => writePath(r.path, value);
export const update = async (r: { path: string }, value: any) => {
  for (const [k, v] of Object.entries(value)) {
    writePath(`${r.path}/${k}`, v);
  }
};
export const remove = async (r: { path: string }) => writePath(r.path, null);
export const push = (r: { path: string }) => ({ path: `${r.path}/p${(state.pushCounter++).toString().padStart(6, '0')}` });
export const onDisconnect = (r: { path: string }) => {
  const uid = state.currentUid;
  return {
    remove: async () => {
      state.disconnects.push({ uid, path: r.path });
    },
  };
};
const listen = (kind: 'value' | 'child_added') => (r: { path: string }, cb: (snap: any) => void) => {
  const l: Listener = { path: r.path, kind, cb, seen: new Set() };
  state.listeners.push(l);
  notify();
  return () => {
    state.listeners = state.listeners.filter(x => x !== l);
  };
};
export const onValue = listen('value');
export const onChildAdded = listen('child_added');
