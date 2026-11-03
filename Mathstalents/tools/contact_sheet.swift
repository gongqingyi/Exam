import AppKit
import Foundation

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: contact_sheet.swift PAGE_DIR OUTPUT_DIR\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(
    at: inputURL,
    includingPropertiesForKeys: nil
).filter { $0.pathExtension.lowercased() == "png" }
 .sorted { $0.lastPathComponent < $1.lastPathComponent }

try FileManager.default.createDirectory(
    at: outputURL,
    withIntermediateDirectories: true
)

let columns = 4
let rows = 4
let perSheet = columns * rows
let tileWidth = 230
let tileHeight = 335
let margin = 18
let labelHeight = 22
let sheetWidth = columns * tileWidth + (columns + 1) * margin
let sheetHeight = rows * tileHeight + (rows + 1) * margin

for sheetIndex in stride(from: 0, to: files.count, by: perSheet) {
    let chunk = Array(files[sheetIndex..<min(sheetIndex + perSheet, files.count)])
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: sheetWidth,
        pixelsHigh: sheetHeight,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("Cannot create contact sheet bitmap")
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    NSColor(calibratedWhite: 0.91, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: sheetWidth, height: sheetHeight).fill()

    for (offset, file) in chunk.enumerated() {
        guard let image = NSImage(contentsOf: file) else { continue }
        let column = offset % columns
        let rowFromTop = offset / columns
        let x = margin + column * (tileWidth + margin)
        let y = sheetHeight - margin - (rowFromTop + 1) * tileHeight - rowFromTop * margin

        NSColor.white.setFill()
        NSRect(x: x, y: y, width: tileWidth, height: tileHeight).fill()

        let available = NSSize(
            width: tileWidth - 8,
            height: tileHeight - labelHeight - 8
        )
        let scale = min(
            available.width / image.size.width,
            available.height / image.size.height
        )
        let drawn = NSSize(
            width: image.size.width * scale,
            height: image.size.height * scale
        )
        let destination = NSRect(
            x: CGFloat(x) + (CGFloat(tileWidth) - drawn.width) / 2,
            y: CGFloat(y + labelHeight + 4),
            width: drawn.width,
            height: drawn.height
        )
        image.draw(
            in: destination,
            from: .zero,
            operation: .sourceOver,
            fraction: 1
        )

        let label = file.deletingPathExtension().lastPathComponent as NSString
        label.draw(
            at: NSPoint(x: x + 7, y: y + 5),
            withAttributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 11, weight: .medium),
                .foregroundColor: NSColor.darkGray,
            ]
        )
    }

    NSGraphicsContext.restoreGraphicsState()
    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Cannot encode contact sheet")
    }
    let number = sheetIndex / perSheet + 1
    let destination = outputURL.appendingPathComponent(
        String(format: "sheet-%02d.png", number)
    )
    try data.write(to: destination)
    print("Created \(destination.lastPathComponent)")
}
