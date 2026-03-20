import Foundation

/// Message types from Electron
enum NotchMessageType: String, Decodable {
    case state
    case ping
    case shutdown
}

/// Envelope for messages from Electron
struct NotchMessage: Decodable {
    let type: NotchMessageType
    let payload: NotchStatePayload?

    enum CodingKeys: String, CodingKey {
        case type
        case payload
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(NotchMessageType.self, forKey: .type)

        // Only decode payload for state messages
        if type == .state {
            payload = try container.decodeIfPresent(NotchStatePayload.self, forKey: .payload)
        } else {
            payload = nil
        }
    }
}

/// Status values matching CodexMonitorState
enum NotchStatus: String, Decodable {
    case idle
    case monitoring
    case analyzing
    case chatting
    case error
}

/// Nudge information from the agent
struct NotchNudge: Decodable {
    let text: String
    let suggestedPhrase: String?
}

/// State payload sent from Electron
struct NotchStatePayload: Decodable {
    let status: NotchStatus
    let noteTitle: String?
    let nudge: NotchNudge?
    let itemCount: Int
    let pendingItemCount: Int
    let error: String?
}
