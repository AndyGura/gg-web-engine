/**
 * Where an `AudioBufferSourceNode` would be in its clip after playing for `position` seconds of
 * clip time (playback rate already applied), following the Web Audio spec's own loop rules: a
 * looping source plays any lead-in before `loopStart` once, then repeats `[loopStart, loopEnd)`;
 * `loopEnd <= 0` (or past the clip) means the end of the clip, and an empty/inverted region loops
 * the whole clip. A non-looping source has `ended` once `position` reaches the clip's duration.
 * Used to restart a virtual (or paused) source exactly where it would have been.
 */
export function wrapPlayhead(
  position: number,
  duration: number,
  loop: boolean,
  loopStart: number,
  loopEnd: number,
): { offset: number; ended: boolean } {
  const pos = Math.max(0, position);
  if (!(duration > 0)) {
    return { offset: 0, ended: !loop };
  }
  if (!loop) {
    return pos >= duration ? { offset: duration, ended: true } : { offset: pos, ended: false };
  }
  let start = Math.max(0, loopStart);
  let end = loopEnd > 0 ? Math.min(loopEnd, duration) : duration;
  if (start >= end) {
    start = 0;
    end = duration;
  }
  if (pos < end) {
    return { offset: pos, ended: false };
  }
  return { offset: start + ((pos - start) % (end - start)), ended: false };
}
