import { useState, useCallback, useRef, useEffect } from "react";

export type AudioSource = "microphone" | "system" | "both";

export interface AudioCaptureState {
  isCapturing: boolean;
  source: AudioSource;
  duration: number;
  error: string | null;
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  screenPermission: "granted" | "denied" | "prompt" | "unknown";
}

export interface UseAudioCaptureOptions {
  sampleRate?: number;
  onChunk?: (chunk: Float32Array, isStereo: boolean) => void;
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}) {
  const { sampleRate = 48000, onChunk } = options;

  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    source: "microphone",
    duration: 0,
    error: null,
    micPermission: "unknown",
    screenPermission: "unknown",
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      const permissions = await window.transcriptionAPI.getPermissions();
      setState((prev) => ({
        ...prev,
        micPermission: permissions.microphone as AudioCaptureState["micPermission"],
        screenPermission: permissions.screen as AudioCaptureState["screenPermission"],
      }));
    } catch (err) {
      console.error("Failed to check permissions:", err);
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    try {
      const granted = await window.transcriptionAPI.requestMicPermission();
      await checkPermissions();
      return granted;
    } catch (err) {
      console.error("Failed to request mic permission:", err);
      return false;
    }
  }, [checkPermissions]);

  const requestScreenPermission = useCallback(async () => {
    try {
      const granted = await window.transcriptionAPI.requestScreenPermission();
      await checkPermissions();
      return granted;
    } catch (err) {
      console.error("Failed to request screen permission:", err);
      return false;
    }
  }, [checkPermissions]);

  const startCapture = useCallback(
    async (source: AudioSource = "microphone") => {
      try {
        setState((prev) => ({ ...prev, error: null, source }));

        // Request appropriate permissions
        if (source === "microphone" || source === "both") {
          if (state.micPermission !== "granted") {
            const granted = await requestMicPermission();
            if (!granted) {
              setState((prev) => ({ ...prev, error: "Microphone permission denied" }));
              return false;
            }
          }
        }

        if (source === "system" || source === "both") {
          if (state.screenPermission !== "granted") {
            const granted = await requestScreenPermission();
            if (!granted) {
              setState((prev) => ({
                ...prev,
                error: "Screen recording permission required for system audio",
              }));
              return false;
            }
          }
        }

        let stream: MediaStream;

        if (source === "microphone") {
          // Microphone only
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate,
            },
          });
        } else if (source === "system") {
          // System audio only (via desktopCapturer)
          stream = await getSystemAudioStream();
        } else {
          // Both microphone and system audio
          const [micStream, sysStream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate,
              },
            }),
            getSystemAudioStream(),
          ]);

          // Merge streams
          stream = mergeAudioStreams(micStream, sysStream);
        }

        mediaStreamRef.current = stream;

        // Set up audio processing
        audioContextRef.current = new AudioContext({ sampleRate });
        const sourceNode = audioContextRef.current.createMediaStreamSource(stream);

        // Use ScriptProcessorNode for raw audio access
        // Note: This is deprecated but worklet requires more setup
        // Smaller buffers reduce how long we wait before handing audio to VAD/transcription.
        const bufferSize = 1024;
        processorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

        processorRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const chunk = new Float32Array(inputData);

          if (onChunk) {
            onChunk(chunk, false);
          }
        };

        sourceNode.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);

        // Start duration timer
        startTimeRef.current = Date.now();
        durationIntervalRef.current = window.setInterval(() => {
          setState((prev) => ({
            ...prev,
            duration: (Date.now() - startTimeRef.current) / 1000,
          }));
        }, 100);

        setState((prev) => ({ ...prev, isCapturing: true, duration: 0 }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start capture";
        setState((prev) => ({ ...prev, error: message }));
        return false;
      }
    },
    [
      state.micPermission,
      state.screenPermission,
      sampleRate,
      onChunk,
      requestMicPermission,
      requestScreenPermission,
    ]
  );

  const stopCapture = useCallback(() => {
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setState((prev) => ({ ...prev, isCapturing: false }));
  }, []);

  return {
    ...state,
    startCapture,
    stopCapture,
    checkPermissions,
    requestMicPermission,
    requestScreenPermission,
  };
}

/**
 * Get system audio stream using Electron's desktopCapturer
 */
async function getSystemAudioStream(): Promise<MediaStream> {
  // Get desktop capturer sources
  const sources = await window.electron?.desktopCapturer?.getSources({
    types: ["screen"],
  });

  if (!sources || sources.length === 0) {
    throw new Error("No screen sources available");
  }

  // Use the first screen source
  const source = sources[0];

  // Request media with the source ID
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error - Electron-specific constraint
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: source.id,
      },
    },
    video: {
      // @ts-expect-error - Electron-specific constraint
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: source.id,
        minWidth: 1,
        maxWidth: 1,
        minHeight: 1,
        maxHeight: 1,
      },
    },
  });

  // Remove video track, we only need audio
  stream.getVideoTracks().forEach((track) => track.stop());

  // Check if we got audio
  if (stream.getAudioTracks().length === 0) {
    throw new Error(
      "No audio track available. Make sure Screen Recording permission is granted in System Settings."
    );
  }

  return new MediaStream(stream.getAudioTracks());
}

/**
 * Merge two audio streams into one
 */
function mergeAudioStreams(stream1: MediaStream, stream2: MediaStream): MediaStream {
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  if (stream1.getAudioTracks().length > 0) {
    const source1 = audioContext.createMediaStreamSource(stream1);
    source1.connect(destination);
  }

  if (stream2.getAudioTracks().length > 0) {
    const source2 = audioContext.createMediaStreamSource(stream2);
    source2.connect(destination);
  }

  return destination.stream;
}
