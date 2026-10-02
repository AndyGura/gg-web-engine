// Backstop sweep for the multiplayer signaling database: every node a client writes is removed by
// onDisconnect() in the common case; this removes whatever a crashed/killed client left behind.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const MAX_AGE_MS = 10 * 60 * 1000;

exports.sweepStaleRooms = onSchedule('every 10 minutes', async () => {
  const cutoff = Date.now() - MAX_AGE_MS;
  const roomsRef = admin.database().ref('gg-rooms');
  const rooms = (await roomsRef.get()).val() || {};
  const updates = {};
  for (const [roomId, room] of Object.entries(rooms)) {
    let alive = false;
    for (const [peerId, presence] of Object.entries(room.presence || {})) {
      if ((presence.ts || 0) < cutoff) {
        updates[`${roomId}/presence/${peerId}`] = null;
      } else {
        alive = true;
      }
    }
    for (const [to, inbox] of Object.entries(room.signals || {})) {
      for (const [id, signal] of Object.entries(inbox || {})) {
        if ((signal.ts || 0) < cutoff) {
          updates[`${roomId}/signals/${to}/${id}`] = null;
        }
      }
    }
    if (!alive && room.meta && (room.meta.createdAt || 0) < cutoff) {
      updates[`${roomId}`] = null;
    }
  }
  if (Object.keys(updates).length > 0) {
    await roomsRef.update(updates);
  }
});
