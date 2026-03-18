import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { getStoredPrivacyPreferences } from "./analytics";

export function ConsentAwareAnalytics({ enabled }: { enabled?: boolean }) {
  const [isEnabled, setIsEnabled] = useState(Boolean(enabled));

  useEffect(() => {
    if (typeof enabled === "boolean") {
      setIsEnabled(enabled);
      return;
    }

    setIsEnabled(getStoredPrivacyPreferences().analytics);
  }, [enabled]);

  if (!isEnabled) {
    return null;
  }

  return <Analytics />;
}
