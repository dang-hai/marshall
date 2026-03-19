import { useCallback, useEffect, useState } from "react";

export interface DetectedCall {
  id: string;
  appName: string;
  appIcon?: string;
  detectedAt: number;
  dismissed: boolean;
}

interface UseCallDetectionResult {
  detectedCalls: DetectedCall[];
  isMonitoring: boolean;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  dismissCall: (callId: string) => Promise<void>;
}

export function useCallDetection(): UseCallDetectionResult {
  const [detectedCalls, setDetectedCalls] = useState<DetectedCall[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    // Check initial monitoring status
    window.callDetectionAPI?.isMonitoring().then(setIsMonitoring);

    // Load existing detected calls
    window.callDetectionAPI?.getDetectedCalls().then(setDetectedCalls);
  }, []);

  useEffect(() => {
    if (!window.callDetectionAPI) {
      return;
    }

    const cleanupCallDetected = window.callDetectionAPI.onCallDetected((call) => {
      setDetectedCalls((current) => {
        // Check if call already exists
        if (current.some((c) => c.id === call.id)) {
          return current;
        }
        return [...current, call];
      });
    });

    const cleanupCallDismissed = window.callDetectionAPI.onCallDismissed((callId) => {
      setDetectedCalls((current) => current.filter((c) => c.id !== callId));
    });

    return () => {
      cleanupCallDetected();
      cleanupCallDismissed();
    };
  }, []);

  const startMonitoring = useCallback(async () => {
    await window.callDetectionAPI?.startMonitoring();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(async () => {
    await window.callDetectionAPI?.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const dismissCall = useCallback(async (callId: string) => {
    await window.callDetectionAPI?.dismissCall(callId);
    setDetectedCalls((current) => current.filter((call) => call.id !== callId));
  }, []);

  return {
    detectedCalls,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    dismissCall,
  };
}
