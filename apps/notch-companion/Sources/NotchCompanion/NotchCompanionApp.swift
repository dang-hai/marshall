import AppKit
import SwiftUI

class NotchCompanionAppDelegate: NSObject, NSApplicationDelegate {
    private let port: Int
    private var windowManager: NotchWindowManager?
    private var webSocketService: WebSocketService?

    init(port: Int) {
        self.port = port
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("[NotchCompanion] Application launched")

        // Initialize WebSocket service
        webSocketService = WebSocketService()

        // Initialize window manager with the WebSocket service
        windowManager = NotchWindowManager(webSocketService: webSocketService!)
        windowManager?.showNotchWindow()

        // Connect to Electron WebSocket server
        webSocketService?.connect(port: port)
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("[NotchCompanion] Application terminating")
        webSocketService?.disconnect()
        windowManager?.hideNotchWindow()
    }
}
