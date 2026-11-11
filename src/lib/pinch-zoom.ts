/** Where the diagram sits in the canvas: offset in pixels and scale factor. */
export interface View {
  x: number;
  y: number;
  k: number;
}

/** Two fingers on the canvas: their distance and midpoint, in canvas coordinates. */
export interface PinchSample {
  distance: number;
  midX: number;
  midY: number;
}

/** The pinch sample taken when the gesture began, and the view at that moment. */
export interface PinchStart extends PinchSample {
  view: View;
}

interface Point {
  x: number;
  y: number;
}

/** Fingers closer than this (in pixels) count as this far apart, so the zoom ratio stays finite. */
const MIN_PINCH_DISTANCE = 1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Distance and midpoint of two fingers, relative to the canvas origin. */
export function pinchSample(a: Point, b: Point, origin: Point): PinchSample {
  return {
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    midX: (a.x + b.x) / 2 - origin.x,
    midY: (a.y + b.y) / 2 - origin.y,
  };
}

/**
 * The view for the current fingers. Scale follows the finger distance; the diagram point that was under the
 * first midpoint stays under the current midpoint, so moving both fingers together also pans.
 */
export function pinchView(start: PinchStart, now: PinchSample, minScale: number, maxScale: number): View {
  const k = clamp(start.view.k * (now.distance / Math.max(start.distance, MIN_PINCH_DISTANCE)), minScale, maxScale);
  const ratio = k / start.view.k;
  return {
    k,
    x: now.midX - (start.midX - start.view.x) * ratio,
    y: now.midY - (start.midY - start.view.y) * ratio,
  };
}
