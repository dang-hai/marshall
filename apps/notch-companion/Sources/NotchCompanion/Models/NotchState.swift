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

/// Action item from the AI monitor
struct ActionItemPayload: Decodable, Identifiable {
    let id: String
    let text: String
    let status: String

    var isDone: Bool { status == "done" }
}

/// Meeting proposal from the AI monitor
struct MeetingProposalPayload: Decodable, Identifiable {
    let id: String
    let title: String
    let startAt: String
    let endAt: String
    let status: String

    var isPending: Bool { status == "pending" }

    var formattedStartTime: String {
        // Parse ISO8601 and return "HH:mm"
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try with fractional seconds first, then without
        if let date = formatter.date(from: startAt) {
            let timeFormatter = DateFormatter()
            timeFormatter.dateFormat = "HH:mm"
            return timeFormatter.string(from: date)
        }

        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: startAt) {
            let timeFormatter = DateFormatter()
            timeFormatter.dateFormat = "HH:mm"
            return timeFormatter.string(from: date)
        }

        return startAt
    }

    var formattedEndTime: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: endAt) {
            let timeFormatter = DateFormatter()
            timeFormatter.dateFormat = "HH:mm"
            return timeFormatter.string(from: date)
        }

        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: endAt) {
            let timeFormatter = DateFormatter()
            timeFormatter.dateFormat = "HH:mm"
            return timeFormatter.string(from: date)
        }

        return endAt
    }
}

/// State payload sent from Electron
struct NotchStatePayload: Decodable {
    let status: NotchStatus
    let noteTitle: String?
    let nudge: NotchNudge?
    let items: [ActionItemPayload]
    let itemCount: Int
    let pendingItemCount: Int
    let error: String?
    let meetingProposals: [MeetingProposalPayload]
}
