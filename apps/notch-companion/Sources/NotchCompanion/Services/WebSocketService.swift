import AppKit
import Foundation

/// WebSocket client for receiving state updates from Electron
class WebSocketService: ObservableObject {
    @Published var state: NotchStatePayload?
    @Published var isConnected: Bool = false

    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var reconnectTimer: Timer?
    private var targetPort: Int = 0

    deinit {
        disconnect()
    }

    func connect(port: Int) {
        targetPort = port
        performConnect()
    }

    private func performConnect() {
        guard let url = URL(string: "ws://127.0.0.1:\(targetPort)/notch") else {
            print("[WebSocket] Invalid URL")
            return
        }

        print("[WebSocket] Connecting to \(url)")

        // Create a new session for each connection
        urlSession = URLSession(configuration: .default)
        webSocketTask = urlSession?.webSocketTask(with: url)
        webSocketTask?.resume()

        // Start receiving messages
        receiveMessage()

        // Mark as connected after a short delay (optimistic)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.isConnected = true
            print("[WebSocket] Connected")
        }
    }

    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        isConnected = false
        print("[WebSocket] Disconnected")
    }

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                // Continue receiving
                self?.receiveMessage()

            case .failure(let error):
                print("[WebSocket] Receive error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                    self?.scheduleReconnect()
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseMessage(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseMessage(text)
            }
        @unknown default:
            print("[WebSocket] Unknown message type")
        }
    }

    private func parseMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else {
            print("[WebSocket] Failed to convert message to data")
            return
        }

        do {
            let message = try JSONDecoder().decode(NotchMessage.self, from: data)
            handleNotchMessage(message)
        } catch {
            print("[WebSocket] Failed to decode message: \(error)")
        }
    }

    private func handleNotchMessage(_ message: NotchMessage) {
        switch message.type {
        case .state:
            if let payload = message.payload {
                DispatchQueue.main.async { [weak self] in
                    self?.state = payload
                }
            }

        case .ping:
            // Respond with pong if needed
            print("[WebSocket] Received ping")

        case .shutdown:
            print("[WebSocket] Received shutdown signal")
            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
        }
    }

    private func scheduleReconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            print("[WebSocket] Attempting reconnect...")
            self?.performConnect()
        }
    }
}
