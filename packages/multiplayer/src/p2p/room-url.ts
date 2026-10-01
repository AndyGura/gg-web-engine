const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A fresh room id: a UUID v4. */
export function generateRoomId(): string {
  const c: Crypto | undefined = (globalThis as any).crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidRoomId(id: string | null | undefined): id is string {
  return !!id && UUID_V4.test(id);
}

/** A short random peer id (8 base-36 characters). */
export function generatePeerId(): string {
  let id = '';
  while (id.length < 8) {
    id += Math.floor(Math.random() * 36).toString(36);
  }
  return id;
}

/**
 * The room id in a page URL's query string (`?room=<id>` by default), or `null` when absent or not
 * a valid room id. A query parameter (not a path segment) keeps static hosts and sub-path deploys
 * working.
 */
export function getRoomIdFromUrl(param: string = 'room', url: string = globalThis.location?.href ?? ''): string | null {
  try {
    const id = new URL(url).searchParams.get(param);
    return isValidRoomId(id) ? id : null;
  } catch {
    return null;
  }
}

/** `url` (default: the current page) with `?room=<roomId>` set, everything else kept. */
export function buildRoomUrl(
  roomId: string,
  param: string = 'room',
  url: string = globalThis.location?.href ?? '',
): string {
  const u = new URL(url);
  u.searchParams.set(param, roomId);
  return u.toString();
}
