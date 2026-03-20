import AppKit
import Foundation

// Parse command line arguments
func parsePort() -> Int {
    for arg in CommandLine.arguments {
        if arg.hasPrefix("--port=") {
            let portStr = String(arg.dropFirst("--port=".count))
            if let port = Int(portStr) {
                return port
            }
        }
    }
    // Default port if not specified
    return 9999
}

let port = parsePort()
print("[NotchCompanion] Starting with port: \(port)")

// Start the application
let app = NSApplication.shared
let delegate = NotchCompanionAppDelegate(port: port)
app.delegate = delegate
app.setActivationPolicy(.accessory) // Menu bar app (no dock icon)
app.run()
