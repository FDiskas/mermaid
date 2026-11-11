import { expect, test } from "bun:test";
import { pinchSample, pinchView, type PinchStart } from "./pinch-zoom";

const origin = { x: 10, y: 20 };

test("pinchSample measures distance and the midpoint relative to the canvas", () => {
  const sample = pinchSample({ x: 110, y: 120 }, { x: 210, y: 120 }, origin);
  expect(sample).toEqual({ distance: 100, midX: 150, midY: 100 });
});

const start: PinchStart = { distance: 100, midX: 200, midY: 100, view: { x: 50, y: 30, k: 1 } };

test("spreading the fingers zooms in around the midpoint", () => {
  const view = pinchView(start, { distance: 200, midX: 200, midY: 100 }, 0.1, 8);
  expect(view.k).toBe(2);
  // The diagram point under the midpoint does not move.
  expect(view.x).toBe(200 - (200 - 50) * 2);
  expect(view.y).toBe(100 - (100 - 30) * 2);
});

test("moving both fingers without changing the distance only pans", () => {
  const view = pinchView(start, { distance: 100, midX: 230, midY: 90 }, 0.1, 8);
  expect(view).toEqual({ k: 1, x: 80, y: 20 });
});

test("the scale stays within the limits", () => {
  expect(pinchView(start, { distance: 100000, midX: 200, midY: 100 }, 0.1, 8).k).toBe(8);
  expect(pinchView(start, { distance: 0.001, midX: 200, midY: 100 }, 0.1, 8).k).toBe(0.1);
});

test("a pinch that began with both fingers on one point does not produce NaN or Infinity", () => {
  const view = pinchView({ ...start, distance: 0 }, { distance: 50, midX: 200, midY: 100 }, 0.1, 8);
  expect(Number.isFinite(view.k)).toBe(true);
  expect(Number.isFinite(view.x)).toBe(true);
  expect(Number.isFinite(view.y)).toBe(true);
});
