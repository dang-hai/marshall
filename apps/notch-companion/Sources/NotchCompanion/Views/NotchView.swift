import SwiftUI
import Combine

/// ViewModel for NotchView
class NotchViewModel: ObservableObject {
    @Published var status: NotchStatus = .idle
    @Published var nudge: NotchNudge?
    @Published var itemCount: Int = 0
    @Published var pendingItemCount: Int = 0
    @Published var noteTitle: String?
    @Published var error: String?
    @Published var isConnected: Bool = false

    private var cancellables = Set<AnyCancellable>()

    init(webSocketService: WebSocketService) {
        // Observe WebSocket state changes
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
            }
            .store(in: &cancellables)

        webSocketService.$isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] connected in
                self?.isConnected = connected
            }
            .store(in: &cancellables)
    }
}

/// Main notch overlay view
struct NotchView: View {
    @ObservedObject var viewModel: NotchViewModel

    var body: some View {
        HStack(spacing: 8) {
            // Status indicator dot
            StatusIndicator(status: viewModel.status, isConnected: viewModel.isConnected)

            // Nudge text (when available)
            if let nudge = viewModel.nudge {
                Text(nudge.text)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .truncationMode(.tail)
            } else if let error = viewModel.error {
                Text(error)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.red.opacity(0.9))
                    .lineLimit(1)
            } else if viewModel.status == .monitoring {
                Text("Listening...")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.white.opacity(0.6))
            } else if viewModel.status == .analyzing {
                Text("Analyzing...")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.white.opacity(0.6))
            }

            Spacer(minLength: 0)

            // Item count badge
            if viewModel.pendingItemCount > 0 {
                Text("\(viewModel.pendingItemCount)")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.white.opacity(0.2)))
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .frame(maxWidth: .infinity)
        .background(Color.black)
        .clipShape(NotchShape())
    }
}

/// Status indicator component
struct StatusIndicator: View {
    let status: NotchStatus
    let isConnected: Bool

    var body: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 8, height: 8)
            .shadow(color: statusColor.opacity(0.5), radius: 2)
    }

    var statusColor: Color {
        if !isConnected {
            return .gray.opacity(0.5)
        }

        switch status {
        case .monitoring:
            return .green
        case .analyzing, .chatting:
            return .blue
        case .error:
            return .red
        case .idle:
            return .gray
        }
    }
}

#Preview {
    let mockService = WebSocketService()
    let viewModel = NotchViewModel(webSocketService: mockService)
    viewModel.status = .monitoring
    viewModel.pendingItemCount = 3
    viewModel.isConnected = true

    return NotchView(viewModel: viewModel)
        .frame(width: 300, height: 32)
        .background(Color.gray.opacity(0.3))
}
