import { Elysia, t } from "elysia";
import WebSocket from "ws";

export interface TranscriptionMessage {
  type: "interim" | "final" | "error" | "speech_started" | "utterance_end" | "metadata";
  text?: string;
  confidence?: number;
  error?: string;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
}

interface DeepgramConnection {
  dgSocket: WebSocket | null;
  isConnected: boolean;
  pendingChunks: (ArrayBuffer | Uint8Array)[];
}

// Limit pending chunks to ~3 seconds of audio at typical chunk sizes to prevent memory leaks
const MAX_PENDING_CHUNKS = 100;

// Store active connections and their Deepgram sockets
const activeConnections = new Map<string, DeepgramConnection>();

export function createTranscriptionRoutes() {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

  if (!deepgramApiKey) {
    console.warn("[Transcription] DEEPGRAM_API_KEY not set - transcription routes disabled");
  }

  return new Elysia({ prefix: "/transcription" })
    .get("/status", () => ({
      enabled: !!deepgramApiKey,
      provider: "deepgram",
    }))
    .ws("/stream", {
      body: t.Any(),

      open(ws) {
        if (!deepgramApiKey) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Deepgram API key not configured",
            } satisfies TranscriptionMessage)
          );
          ws.close();
          return;
        }

        const connectionId = ws.id;
        console.log(`[Transcription] WebSocket connection opened: ${connectionId}`);
        console.log(`[Transcription] Using Deepgram API key: ${deepgramApiKey.substring(0, 8)}...`);

        // Initialize connection state
        activeConnections.set(connectionId, {
          dgSocket: null,
          isConnected: false,
          pendingChunks: [],
        });

        // Build Deepgram WebSocket URL with query parameters
        const params = new URLSearchParams({
          model: "nova-2",
          language: "en",
          smart_format: "true",
          interim_results: "true",
          utterance_end_ms: "1000",
          vad_events: "true",
          sample_rate: "16000",
          encoding: "linear16",
          channels: "1",
        });

        const deepgramUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
        console.log(`[Transcription] Connecting to Deepgram: ${deepgramUrl}`);

        // Create WebSocket connection with auth header
        const dgSocket = new WebSocket(deepgramUrl, {
          headers: {
            Authorization: `Token ${deepgramApiKey}`,
          },
        });

        const connection = activeConnections.get(connectionId);
        if (connection) {
          connection.dgSocket = dgSocket;
        }

        dgSocket.on("open", () => {
          console.log(`[Transcription] Deepgram connection opened: ${connectionId}`);
          const conn = activeConnections.get(connectionId);
          if (conn) {
            conn.isConnected = true;

            // Flush any pending audio chunks
            if (conn.pendingChunks.length > 0) {
              console.log(
                `[Transcription] Flushing ${conn.pendingChunks.length} pending audio chunks`
              );
              for (const chunk of conn.pendingChunks) {
                conn.dgSocket?.send(chunk);
              }
              conn.pendingChunks = [];
            }
          }
        });

        dgSocket.on("message", (data: WebSocket.RawData) => {
          try {
            const response = JSON.parse(data.toString());

            if (response.type === "Results") {
              const channel = response.channel;
              const transcript = channel?.alternatives?.[0];
              if (!transcript) return;

              const isFinal = response.is_final;

              const message: TranscriptionMessage = {
                type: isFinal ? "final" : "interim",
                text: transcript.transcript || "",
                confidence: transcript.confidence,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                words: transcript.words?.map((w: any) => ({
                  word: w.word || "",
                  start: w.start || 0,
                  end: w.end || 0,
                  confidence: w.confidence || 0,
                })),
              };

              ws.send(JSON.stringify(message));
            } else if (response.type === "SpeechStarted") {
              ws.send(JSON.stringify({ type: "speech_started" } satisfies TranscriptionMessage));
            } else if (response.type === "UtteranceEnd") {
              ws.send(JSON.stringify({ type: "utterance_end" } satisfies TranscriptionMessage));
            } else if (response.type === "Metadata") {
              ws.send(JSON.stringify({ type: "metadata" } satisfies TranscriptionMessage));
            }
          } catch (error) {
            console.error(`[Transcription] Failed to parse Deepgram message:`, error);
          }
        });

        dgSocket.on("error", (error: Error) => {
          console.error(`[Transcription] Deepgram error: ${connectionId}`, error);
          ws.send(
            JSON.stringify({
              type: "error",
              error: error.message || "Deepgram connection error",
            } satisfies TranscriptionMessage)
          );
        });

        dgSocket.on("close", (code: number, reason: Buffer) => {
          console.log(
            `[Transcription] Deepgram connection closed: ${connectionId}, code=${code}, reason=${reason.toString()}`
          );
          const conn = activeConnections.get(connectionId);
          if (conn) {
            conn.isConnected = false;
          }
        });
      },

      message(ws, message) {
        const connectionId = ws.id;
        const connection = activeConnections.get(connectionId);

        if (!connection) {
          return;
        }

        // Message is binary audio data (ArrayBuffer or Buffer)
        if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
          if (connection.dgSocket?.readyState === WebSocket.OPEN) {
            connection.dgSocket.send(message);
          } else if (connection.pendingChunks.length < MAX_PENDING_CHUNKS) {
            // Queue audio chunks until Deepgram connection is ready (bounded to prevent memory leaks)
            connection.pendingChunks.push(message);
          } else if (connection.pendingChunks.length === MAX_PENDING_CHUNKS) {
            console.warn(`[Transcription] Buffer full, dropping audio chunks: ${connectionId}`);
          }
        } else if (typeof message === "string") {
          // Handle control messages
          try {
            const control = JSON.parse(message);
            if (control.type === "close") {
              connection.dgSocket?.close();
            }
          } catch {
            // Not a control message, ignore
          }
        }
      },

      close(ws) {
        const connectionId = ws.id;
        console.log(`[Transcription] WebSocket connection closed: ${connectionId}`);

        const connection = activeConnections.get(connectionId);
        if (connection?.dgSocket) {
          connection.dgSocket.close();
        }
        activeConnections.delete(connectionId);
      },
    });
}
