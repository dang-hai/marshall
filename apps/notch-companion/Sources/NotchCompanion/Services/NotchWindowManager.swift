import AppKit
import SwiftUI

/// Custom NSPanel for notch overlay
/// Based on boring.notch BoringNotchWindow configuration
class NotchPanel: NSPanel {
    override init(
        contentRect: NSRect,
        styleMask: NSWindow.StyleMask,
        backing: NSWindow.BackingStoreType,
        defer flag: Bool
    ) {
        super.init(
            contentRect: contentRect,
            styleMask: [.borderless, .nonactivatingPanel, .utilityWindow, .hudWindow],
            backing: backing,
            defer: flag
        )

        isFloatingPanel = true
        isOpaque = false
        titleVisibility = .hidden
        titlebarAppearsTransparent = true
        backgroundColor = .clear
        isMovable = false
        level = .mainMenu + 3  // Above menu bar
        hasShadow = false
        isReleasedWhenClosed = false

        collectionBehavior = [
            .fullScreenAuxiliary,  // Visible over fullscreen apps
            .stationary,           // Doesn't move with spaces
            .canJoinAllSpaces,     // Visible on all spaces
            .ignoresCycle,         // Not in Cmd+Tab
        ]
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

/// Manages the notch overlay window
class NotchWindowManager {
    private var panel: NotchPanel?
    private let webSocketService: WebSocketService

    init(webSocketService: WebSocketService) {
        self.webSocketService = webSocketService
    }

    func showNotchWindow() {
        guard let screen = NSScreen.main else {
            print("[NotchWindow] No main screen available")
            return
        }

        let notchSize = getNotchSize(screen: screen)
        let windowWidth = max(notchSize.width + 100, 300) // Extend beyond notch
        let windowHeight: CGFloat = 32

        let contentRect = NSRect(
            x: 0,
            y: 0,
            width: windowWidth,
            height: windowHeight
        )

        panel = NotchPanel(
            contentRect: contentRect,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )

        guard let panel = panel else { return }

        // Create SwiftUI view
        let viewModel = NotchViewModel(webSocketService: webSocketService)
        let notchView = NotchView(viewModel: viewModel)
        let hostingView = NSHostingView(rootView: notchView)
        hostingView.frame = contentRect

        panel.contentView = hostingView

        // Position the window
        positionWindow(panel, on: screen)

        // Show the panel
        panel.orderFrontRegardless()

        print("[NotchWindow] Window shown at \(panel.frame)")
    }

    func hideNotchWindow() {
        panel?.orderOut(nil)
        panel = nil
    }

    /// Position window centered at top of screen (over notch area)
    private func positionWindow(_ window: NSWindow, on screen: NSScreen) {
        let screenFrame = screen.frame
        let windowFrame = window.frame

        let x = screenFrame.origin.x + (screenFrame.width / 2) - (windowFrame.width / 2)
        let y = screenFrame.origin.y + screenFrame.height - windowFrame.height

        window.setFrameOrigin(NSPoint(x: x, y: y))
    }

    /// Get notch dimensions using auxiliary areas
    /// Based on boring.notch sizing logic
    private func getNotchSize(screen: NSScreen) -> CGSize {
        var notchWidth: CGFloat = 185  // Default for M1/M2 MacBooks
        var notchHeight: CGFloat = 32

        // Get exact notch width using auxiliary areas (macOS 12+)
        if let topLeft = screen.auxiliaryTopLeftArea?.width,
           let topRight = screen.auxiliaryTopRightArea?.width {
            notchWidth = screen.frame.width - topLeft - topRight + 4
        }

        // Check if Mac has hardware notch
        if screen.safeAreaInsets.top > 0 {
            notchHeight = screen.safeAreaInsets.top
        }

        return CGSize(width: notchWidth, height: notchHeight)
    }
}
