// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "NotchCompanion",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "NotchCompanion",
            path: "Sources/NotchCompanion"
        )
    ]
)
