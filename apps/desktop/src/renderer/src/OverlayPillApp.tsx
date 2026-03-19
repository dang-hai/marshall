import { useEffect, useState } from "react";
import { FloatingOverlayPill } from "./components/FloatingOverlayPill";

type OverlayActivityState = "idle" | "recording" | "transcribing";

export function OverlayPillApp() {
  const [activityState, setActivityState] = useState<OverlayActivityState>("idle");

  useEffect(() => {
    let mounted = true;

    void window.transcriptionAPI.getStatus().then((status) => {
      if (!mounted) {
        return;
      }

      setActivityState(status.activity ?? (status.recording ? "recording" : "idle"));
    });

    const unsubscribe = window.transcriptionAPI.onActivityState((state) => {
      setActivityState(state);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return <FloatingOverlayPill isActive={activityState !== "idle"} />;
}
