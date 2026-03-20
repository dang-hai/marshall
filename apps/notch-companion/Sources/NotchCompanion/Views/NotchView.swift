import SwiftUI
import Combine

// MARK: - Layout Constants (like boring.notch sizing/matters.swift)

enum NotchSizing {
    // Closed state - wider than hardware notch to show content on sides
    static let closedWidth: CGFloat = 260  // 185 * 1.4 ≈ 260
    static let closedHeight: CGFloat = 32

    // Open state - fixed expanded size (includes internal padding)
    static let openWidth: CGFloat = 660
    static let openHeight: CGFloat = 240

    // Corner radii
    static let closedTopRadius: CGFloat = 6
    static let closedBottomRadius: CGFloat = 14
    static let openTopRadius: CGFloat = 16
    static let openBottomRadius: CGFloat = 22

    // Content padding
    static let horizontalPadding: CGFloat = 16
    static let verticalPadding: CGFloat = 12

    // Header height (same as closed notch height)
    static let headerHeight: CGFloat = 32
}

// MARK: - View Model

class NotchViewModel: ObservableObject {
    @Published var status: NotchStatus = .idle
    @Published var nudge: NotchNudge?
    @Published var itemCount: Int = 0
    @Published var pendingItemCount: Int = 0
    @Published var noteTitle: String?
    @Published var error: String?
    @Published var connectionState: ConnectionState = .disconnected
    @Published var isExpanded: Bool = false

    // Meeting proposals from WebSocket
    @Published var meetingProposals: [MeetingProposalPayload] = []
    // Action items from WebSocket
    @Published var actionItems: [ActionItemPayload] = []

    private var cancellables = Set<AnyCancellable>()
    private let webSocketService: WebSocketService

    init(webSocketService: WebSocketService) {
        self.webSocketService = webSocketService

        webSocketService.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let state = state else { return }
                self?.status = state.status
                self?.nudge = state.nudge
                self?.itemCount = state.itemCount
                self?.pendingItemCount = state.pendingItemCount
                self?.noteTitle = state.noteTitle
                self?.error = state.error
                self?.actionItems = state.items
                self?.meetingProposals = state.meetingProposals
            }
            .store(in: &cancellables)

        webSocketService.$connectionState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.connectionState = state
            }
            .store(in: &cancellables)
    }

    func acceptProposal(_ id: String) {
        webSocketService.sendAction("acceptProposal", proposalId: id)
    }

    func remindProposal(_ id: String) {
        webSocketService.sendAction("remindProposal", proposalId: id)
    }

    func discardProposal(_ id: String) {
        webSocketService.sendAction("discardProposal", proposalId: id)
    }
}

// ActionItem is now ActionItemPayload from NotchState.swift
// MeetingProposal is now MeetingProposalPayload from NotchState.swift

// MARK: - Main Notch View

struct NotchView: View {
    @ObservedObject var viewModel: NotchViewModel
    @State private var isHovering = false

    private var notchWidth: CGFloat {
        viewModel.isExpanded ? NotchSizing.openWidth : NotchSizing.closedWidth
    }

    private var notchHeight: CGFloat {
        viewModel.isExpanded ? NotchSizing.openHeight : NotchSizing.closedHeight
    }

    private var topRadius: CGFloat {
        viewModel.isExpanded ? NotchSizing.openTopRadius : NotchSizing.closedTopRadius
    }

    private var bottomRadius: CGFloat {
        viewModel.isExpanded ? NotchSizing.openBottomRadius : NotchSizing.closedBottomRadius
    }

    var body: some View {
        notchContent
            .frame(width: notchWidth, height: notchHeight, alignment: .top)
            .background(Color.black)
            .clipShape(NotchShape(topCornerRadius: topRadius, bottomCornerRadius: bottomRadius))
            .onHover { hovering in
                // Only detect hover on the actual notch area, not the entire window
                isHovering = hovering
                if hovering && !viewModel.isExpanded {
                    // Delay expansion to avoid accidental triggers
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        if isHovering {
                            withAnimation { viewModel.isExpanded = true }
                        }
                    }
                }
            }
            .onTapGesture {
                withAnimation { viewModel.isExpanded.toggle() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .animation(.spring(response: 0.38, dampingFraction: 0.8), value: viewModel.isExpanded)
    }

    @ViewBuilder
    private var notchContent: some View {
        if viewModel.isExpanded {
            expandedLayout
        } else {
            closedLayout
        }
    }

    // MARK: - Closed Layout

    private var closedLayout: some View {
        HStack(spacing: 8) {
            StatusDot(status: viewModel.status, connectionState: viewModel.connectionState)

            if let nudge = viewModel.nudge {
                Text(nudge.text)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
            } else {
                Text(statusLabel)
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.6))
            }

            Spacer(minLength: 0)

            if viewModel.pendingItemCount > 0 {
                BadgeView(count: viewModel.pendingItemCount)
            }
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var statusLabel: String {
        switch viewModel.status {
        case .monitoring: return "Listening..."
        case .analyzing: return "Analyzing..."
        case .chatting: return "Chatting..."
        case .error: return viewModel.error ?? "Error"
        case .idle: return "Idle"
        }
    }

    // MARK: - Expanded Layout

    private var expandedLayout: some View {
        VStack(spacing: 0) {
            // Header bar - fixed height, same as closed notch
            expandedHeader
                .frame(height: NotchSizing.headerHeight)

            // Main content area - takes remaining space
            HStack(alignment: .top, spacing: 16) {
                // Left panel: Status & Actions (fixed width)
                leftPanel
                    .frame(width: 200)

                // Divider
                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 1)

                // Right panel: Calendar (flexible width)
                rightPanel
                    .frame(maxWidth: .infinity)
            }
            .padding(.top, 8)
            .frame(maxHeight: .infinity)
        }
        // Internal padding - creates space inside the black background
        .padding(.horizontal, 32)
        .padding(.bottom, 24)
        .padding(.top, 12)
    }

    private var expandedHeader: some View {
        HStack(spacing: 10) {
            StatusDot(status: viewModel.status, connectionState: viewModel.connectionState)

            Text(viewModel.noteTitle ?? "Marshall")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
                .lineLimit(1)

            Spacer()

            // Collapse button
            Button(action: { withAnimation { viewModel.isExpanded = false } }) {
                Image(systemName: "chevron.up")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.5))
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(PlainButtonStyle())
        }
    }

    // MARK: - Left Panel (Status & Actions)

    private var leftPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Nudge/Suggestion card
            if let nudge = viewModel.nudge {
                NudgeCard(nudge: nudge)
            } else {
                StatusCard(status: viewModel.status, connectionState: viewModel.connectionState)
            }

            // Action items
            VStack(alignment: .leading, spacing: 6) {
                Text("ACTION ITEMS")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(.white.opacity(0.4))
                    .tracking(0.5)

                ForEach(viewModel.actionItems.prefix(3)) { item in
                    ActionItemRow(item: item)
                }
            }

            Spacer(minLength: 0)
        }
    }

    // MARK: - Right Panel (Calendar)

    private var rightPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("UPCOMING")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(.white.opacity(0.4))
                    .tracking(0.5)

                Spacer()

                Text(todayLabel)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.white.opacity(0.4))
            }

            // Events list
            VStack(spacing: 4) {
                ForEach(viewModel.events) { event in
                    CalendarEventRow(event: event)
                }
            }

            Spacer(minLength: 0)
        }
    }

    private var todayLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: Date())
    }
}

// MARK: - Subcomponents

struct StatusDot: View {
    let status: NotchStatus
    let connectionState: ConnectionState

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 8, height: 8)
    }

    private var color: Color {
        switch connectionState {
        case .disconnected:
            return .red
        case .connecting:
            return .orange
        case .connected:
            switch status {
            case .monitoring: return .green
            case .analyzing, .chatting: return .blue
            case .error: return .red
            case .idle: return .gray
            }
        }
    }
}

struct BadgeView: View {
    let count: Int

    var body: some View {
        Text("\(count)")
            .font(.system(size: 10, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Capsule().fill(Color.white.opacity(0.2)))
    }
}

struct NudgeCard: View {
    let nudge: NotchNudge

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(nudge.text)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.white)
                .lineLimit(2)

            if let phrase = nudge.suggestedPhrase {
                Text("\"\(phrase)\"")
                    .font(.system(size: 10))
                    .foregroundColor(.blue)
                    .italic()
                    .lineLimit(1)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.08))
        .cornerRadius(8)
    }
}

struct StatusCard: View {
    let status: NotchStatus
    let connectionState: ConnectionState

    var body: some View {
        HStack(spacing: 8) {
            StatusDot(status: status, connectionState: connectionState)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.08))
        .cornerRadius(8)
    }

    private var label: String {
        switch status {
        case .monitoring: return "Monitoring call"
        case .analyzing: return "Analyzing..."
        case .chatting: return "Chatting"
        case .error: return "Error"
        case .idle: return "Idle"
        }
    }
}

struct ActionItemRow: View {
    let item: ActionItemPayload

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 10))
                .foregroundColor(item.isDone ? .green : .white.opacity(0.4))

            Text(item.text)
                .font(.system(size: 10))
                .foregroundColor(item.isDone ? .white.opacity(0.5) : .white.opacity(0.8))
                .strikethrough(item.isDone)
                .lineLimit(1)
        }
    }
}

struct CalendarEventRow: View {
    let event: CalendarEvent

    var body: some View {
        HStack(spacing: 8) {
            // Color indicator
            RoundedRectangle(cornerRadius: 1.5)
                .fill(event.color)
                .frame(width: 3, height: 28)

            // Event info
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)

                if let location = event.location {
                    Text(location)
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.5))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            // Time
            VStack(alignment: .trailing, spacing: 2) {
                Text(event.time)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white)
                Text(event.endTime)
                    .font(.system(size: 9))
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .background(Color.white.opacity(0.05))
        .cornerRadius(6)
    }
}

// MARK: - Previews

#Preview("Closed") {
    let mockService = WebSocketService()
    let viewModel = NotchViewModel(webSocketService: mockService)
    viewModel.isExpanded = false

    return NotchView(viewModel: viewModel)
        .padding(40)
        .background(Color.gray.opacity(0.3))
}

#Preview("Expanded") {
    let mockService = WebSocketService()
    let viewModel = NotchViewModel(webSocketService: mockService)
    viewModel.isExpanded = true
    viewModel.nudge = NotchNudge(
        text: "Ask about the Q2 timeline",
        suggestedPhrase: "What's the expected timeline?"
    )

    return NotchView(viewModel: viewModel)
        .padding(40)
        .background(Color.gray.opacity(0.3))
}
