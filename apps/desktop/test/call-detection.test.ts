import { describe, expect, test } from "bun:test";
import { detectCallFromProcess, getProcessName } from "../src/shared/call-detection";

describe("call detection helpers", () => {
  test("extracts the executable name from a process path", () => {
    expect(getProcessName("/Applications/zoom.us.app/Contents/MacOS/zoom.us")).toBe("zoom.us");
  });

  test("ignores the macOS FaceTime conversation background service", () => {
    expect(
      detectCallFromProcess(
        "/System/Library/PrivateFrameworks/TelephonyUtilities.framework/XPCServices/com.apple.FaceTime.FTConversationService.xpc/Contents/MacOS/com.apple.FaceTime.FTConversationService"
      )
    ).toBeNull();
  });

  test("still detects the FaceTime app executable itself", () => {
    expect(
      detectCallFromProcess("/System/Applications/FaceTime.app/Contents/MacOS/FaceTime")
    ).toEqual({ appName: "FaceTime" });
  });
});
