"use client";

import { useEffect } from "react";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Device tilt as a normalised, calibrated, clamped -1..1 signal.
 *
 * **This is not parallax and must not become it.** 01-design-system.md forbids
 * driving the landing cluster's position from device orientation, because a
 * scene that translates under head/hand movement is a vestibular mismatch and
 * a motion-sickness risk. That rule stands. What reads this signal instead is
 * a DOM label that shifts a few pixels, and a shader uniform that moves where
 * a highlight falls on a material — neither moves anything through space. See
 * 01-design-system.md's Tilt-reactive behaviours section.
 *
 * Four things this has to get right, none of them optional:
 *
 * - **Permission.** iOS 13+ exposes `DeviceOrientationEvent.requestPermission`
 *   and refuses to fire the event until it resolves `granted`, and it must be
 *   called from a user gesture. Browsers without that method (Android Chrome,
 *   desktop) just deliver events.
 * - **Calibration.** Nobody holds a phone flat. The first reading becomes the
 *   zero point and everything after is a delta from it, so the effect is
 *   centred on however the device is actually being held. This also absorbs
 *   the platform differences in what `beta`/`gamma` are measured against.
 * - **Screen orientation.** `beta`/`gamma` are in device space. In landscape
 *   the device's axes are rotated relative to what the viewer calls left and
 *   up, so they are rotated back by the screen angle.
 * - **Clamping.** A full turn of the wrist must not fling anything anywhere:
 *   past TILT_RANGE_DEG the signal saturates at ±1.
 */

/** Degrees away from the calibrated baseline that map to the full ±1. */
const TILT_RANGE_DEG = 22;
/**
 * Easing toward the newest reading, applied per event rather than per frame.
 * Accelerometer output is noisy enough that raw values visibly jitter a text
 * label; this is heavy enough to settle that without feeling laggy.
 */
const TILT_EASE = 0.14;
/** Below this the write is skipped, so a device at rest stops re-rendering
 * every subscriber on sensor noise alone. */
const TILT_WRITE_EPSILON = 0.004;

type PermissionCapable = {
  requestPermission?: () => Promise<PermissionState | "granted" | "denied">;
};

/** iOS 13+ only. Everywhere else the event just fires. */
function permissionGate(): (() => Promise<boolean>) | null {
  if (typeof DeviceOrientationEvent === "undefined") return null;
  const request = (DeviceOrientationEvent as unknown as PermissionCapable)
    .requestPermission;
  if (typeof request !== "function") return null;
  return async () => {
    try {
      return (await request()) === "granted";
    } catch {
      // Called outside a user gesture, or dismissed. Not an error worth
      // surfacing — the page simply goes without the effect.
      return false;
    }
  };
}

/** Wrap a degree delta into -180..180 so crossing the ±180 seam doesn't spike. */
function wrapDegrees(delta: number) {
  return ((((delta + 180) % 360) + 360) % 360) - 180;
}

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function screenAngle() {
  if (typeof screen !== "undefined" && screen.orientation) {
    return screen.orientation.angle ?? 0;
  }
  return 0;
}

/**
 * Rotate device-space (gamma, beta) into viewer-space (x right, y down) for
 * the current screen orientation. Portrait is the identity case.
 */
function toViewerAxes(gamma: number, beta: number) {
  switch (screenAngle()) {
    case 90:
      return { x: beta, y: -gamma };
    case 180:
      return { x: -gamma, y: -beta };
    case 270:
      return { x: -beta, y: gamma };
    default:
      return { x: gamma, y: beta };
  }
}

/**
 * Installs the tilt listener and publishes to the scene store. Renders
 * nothing; mount once (see app/device-tilt.tsx).
 *
 * `enabled` should be false on anything without a touch pointer — a laptop
 * with an accelerometer should not start tilting its UI.
 */
export function useDeviceTilt(enabled: boolean) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);

  useEffect(() => {
    const { setTilt, setTiltActive } = useSceneStore.getState();

    if (!enabled || reducedMotion || typeof window === "undefined") {
      setTiltActive(false);
      setTilt({ x: 0, y: 0 });
      return;
    }
    if (typeof DeviceOrientationEvent === "undefined") return;

    let disposed = false;
    let baseline: { beta: number; gamma: number } | null = null;
    const eased = { x: 0, y: 0 };
    let written = { x: 0, y: 0 };

    function handleOrientation(event: DeviceOrientationEvent) {
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;

      // First usable reading defines "level", whatever the hand is doing.
      if (!baseline) {
        baseline = { beta, gamma };
        useSceneStore.getState().setTiltActive(true);
        return;
      }

      const raw = toViewerAxes(
        wrapDegrees(gamma - baseline.gamma),
        wrapDegrees(beta - baseline.beta),
      );
      const target = {
        x: clampUnit(raw.x / TILT_RANGE_DEG),
        y: clampUnit(raw.y / TILT_RANGE_DEG),
      };

      eased.x += (target.x - eased.x) * TILT_EASE;
      eased.y += (target.y - eased.y) * TILT_EASE;

      if (
        Math.abs(eased.x - written.x) < TILT_WRITE_EPSILON &&
        Math.abs(eased.y - written.y) < TILT_WRITE_EPSILON
      ) {
        return;
      }
      written = { x: eased.x, y: eased.y };
      useSceneStore.getState().setTilt(written);
    }

    // Re-level when the screen rotates: the axes have just been remapped
    // underneath us, so the old baseline describes a different pose.
    function handleOrientationChange() {
      baseline = null;
    }

    function subscribe() {
      if (disposed) return;
      window.addEventListener("deviceorientation", handleOrientation);
      screen.orientation?.addEventListener?.("change", handleOrientationChange);
    }

    const gate = permissionGate();
    let releaseGesture: (() => void) | undefined;

    if (!gate) {
      subscribe();
    } else {
      // iOS: the request only counts inside a user gesture, so it waits for
      // the first one. Passive and non-blocking — whatever that tap was for
      // still happens; the permission sheet is the platform's business.
      const onGesture = () => {
        releaseGesture?.();
        gate().then((granted) => {
          if (granted) subscribe();
        });
      };
      releaseGesture = () => {
        window.removeEventListener("touchend", onGesture);
        window.removeEventListener("click", onGesture);
        releaseGesture = undefined;
      };
      window.addEventListener("touchend", onGesture, { passive: true });
      window.addEventListener("click", onGesture);
    }

    return () => {
      disposed = true;
      releaseGesture?.();
      window.removeEventListener("deviceorientation", handleOrientation);
      screen.orientation?.removeEventListener?.(
        "change",
        handleOrientationChange,
      );
      const store = useSceneStore.getState();
      store.setTiltActive(false);
      store.setTilt({ x: 0, y: 0 });
    };
  }, [enabled, reducedMotion]);
}
