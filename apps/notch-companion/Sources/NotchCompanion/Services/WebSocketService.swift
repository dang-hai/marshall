import AppKit
import Foundation

/// Connection state for the WebSocket
enum ConnectionState {
    case disconnected
    case connecting
    case connected
}

/// WebSocket client for receiving state updates from Electron
class WebSocketService: ObservableObject {
    @Published var state: NotchStatePayload?
    @Published var connectionState: ConnectionState = .disconnected

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
        guard let url = URL(string: "ws://127.0.0.1:\(targetPort)") else {
            print("[WebSocket] Invalid URL")
            return
        }

        print("[WebSocket] Connecting to \(url)...")
        DispatchQueue.main.async { [weak self] in
            self?.connectionState = .connecting
            print("[WebSocket] State changed to: connecting")
        }

        // Create a new session for each connection
        urlSession = URLSession(configuration: .default)
        webSocketTask = urlSession?.webSocketTask(with: url)
        webSocketTask?.resume()

        // Send a ping to verify connection
        webSocketTask?.sendPing { [weak self] error in
            DispatchQueue.main.async {
                if let error = error {
                    print("[WebSocket] Connection failed: \(error.localizedDescription)")
                    self?.connectionState = .disconnected
                    print("[WebSocket] State changed to: disconnected")
                    self?.scheduleReconnect()
                } else {
                    print("[WebSocket] Connected successfully!")
                    self?.connectionState = .connected
                    print("[WebSocket] State changed to: connected")
                    // Start receiving messages after confirmed connection
                    self?.receiveMessage()
                }
            }
        }
    }

    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        connectionState = .disconnected
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
                    self?.connectionState = .disconnected
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
                print("[WebSocket] Received state: status=\(payload.status), items=\(payload.items.count), nudge=\(payload.nudge != nil)")
                DispatchQueue.main.async { [weak self] in
                    self?.state = payload
                }
            } else {
                print("[WebSocket] Received state message but payload was nil")
            }

        case .ping:
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

    /// Send an action to Electron (e.g., accept/remind/discard proposal)
    func sendAction(_ action: String, proposalId: String) {
        let message: [String: Any] = [
            "type": "action",
            "action": action,
            "payload": ["proposalId": proposalId]
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let text = String(data: data, encoding: .utf8) else {
            print("[WebSocket] Failed to serialize action message")
            return
        }

        webSocketTask?.send(.string(text)) { error in
            if let error = error {
                print("[WebSocket] Send error: \(error.localizedDescription)")
            } else {
                print("[WebSocket] Sent action: \(action) for proposal: \(proposalId)")
            }
        }
    }
}
