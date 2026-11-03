import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: render_pdf.swift INPUT.pdf OUTPUT_DIR [scale]\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let scale = CommandLine.arguments.count >= 4
    ? CGFloat(Double(CommandLine.arguments[3]) ?? 2.0)
    : 2.0

guard let document = PDFDocument(url: inputURL) else {
    fputs("Cannot open PDF: \(inputURL.path)\n", stderr)
    exit(1)
}

try FileManager.default.createDirectory(
    at: outputURL,
    withIntermediateDirectories: true
)

for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { continue }
    let box = page.bounds(for: .mediaBox)
    let width = Int(ceil(box.width * scale))
    let height = Int(ceil(box.height * scale))

    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: bitmap)?.cgContext else {
        fputs("Cannot create bitmap for page \(index + 1)\n", stderr)
        exit(1)
    }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()

    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        fputs("Cannot encode page \(index + 1)\n", stderr)
        exit(1)
    }
    let filename = String(format: "page-%03d.png", index + 1)
    try data.write(to: outputURL.appendingPathComponent(filename))
    print("Rendered \(filename)")
}
