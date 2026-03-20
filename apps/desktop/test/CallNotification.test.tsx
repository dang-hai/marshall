import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CALL_NOTIFICATION_TIMEOUT_MS,
  CallNotification,
  createCallNotificationTimerState,
  getCallNotificationProgressPercent,
  isCallNotificationTimerActive,
  reduceCallNotificationTimer,
} from "../src/renderer/src/components/CallNotification";

const baseCall = {
  id: "call-1",
  appName: "Zoom",
  detectedAt: Date.parse("2026-03-20T10:00:00.000Z"),
  dismissed: false,
};

describe("call notification timer", () => {
  test("counts down until the timeout is reached", () => {
    let state = createCallNotificationTimerState();

    state = reduceCallNotificationTimer(state, { type: "tick", elapsedMs: 2_500 });

    expect(state.remainingMs).toBe(CALL_NOTIFICATION_TIMEOUT_MS - 2_500);
    expect(state.hasTimedOut).toBe(false);
    expect(isCallNotificationTimerActive(state)).toBe(true);

    state = reduceCallNotificationTimer(state, {
      type: "tick",
      elapsedMs: CALL_NOTIFICATION_TIMEOUT_MS,
    });

    expect(state.remainingMs).toBe(0);
    expect(state.hasTimedOut).toBe(true);
    expect(isCallNotificationTimerActive(state)).toBe(false);
  });

  test("pauses on hover and resumes after hover ends", () => {
    let state = createCallNotificationTimerState();

    state = reduceCallNotificationTimer(state, { type: "hover-start" });
    expect(isCallNotificationTimerActive(state)).toBe(false);

    state = reduceCallNotificationTimer(state, { type: "tick", elapsedMs: 1_500 });
    expect(state.remainingMs).toBe(CALL_NOTIFICATION_TIMEOUT_MS);

    state = reduceCallNotificationTimer(state, { type: "hover-end" });
    expect(isCallNotificationTimerActive(state)).toBe(true);

    state = reduceCallNotificationTimer(state, { type: "tick", elapsedMs: 1_500 });
    expect(state.remainingMs).toBe(CALL_NOTIFICATION_TIMEOUT_MS - 1_500);
  });

  test("stops permanently once quick note has started", () => {
    let state = createCallNotificationTimerState();

    state = reduceCallNotificationTimer(state, { type: "quick-note-start" });

    expect(state.hasStartedQuickNote).toBe(true);
    expect(isCallNotificationTimerActive(state)).toBe(false);

    state = reduceCallNotificationTimer(state, { type: "hover-start" });
    state = reduceCallNotificationTimer(state, { type: "hover-end" });
    state = reduceCallNotificationTimer(state, { type: "tick", elapsedMs: 3_000 });

    expect(state.isHovered).toBe(false);
    expect(state.remainingMs).toBe(CALL_NOTIFICATION_TIMEOUT_MS);
    expect(getCallNotificationProgressPercent(state.remainingMs)).toBe(100);
  });
});

describe("CallNotification", () => {
  test("renders the timeout bar along the bottom edge", () => {
    const markup = renderToStaticMarkup(
      <CallNotification
        call={baseCall}
        onCreateNote={() => {}}
        onDismiss={() => {}}
        onStartTranscription={() => {}}
      />
    );

    expect(markup).toContain("Quick note");
    expect(markup).toContain('style="width:100%"');
  });
});
