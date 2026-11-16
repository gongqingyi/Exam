import Vision
import AppKit
import Foundation

// Usage: swift ocr_screenshot.swift image.png
// Prints one line per text box: x y width height text
// Origin is the bottom-left of the image, values are 0...1.
// Higher y is higher on the page. Left column is x < 0.45.

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)
guard let img = NSImage(contentsOf: url) else {
    fputs("cannot load \(path)\n", stderr)
    exit(1)
}
var rect = NSRect(origin: .zero, size: img.size)
guard let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
    fputs("no cgimage\n", stderr)
    exit(1)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.usesLanguageCorrection = false
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([request])
for obs in request.results ?? [] {
    guard let cand = obs.topCandidates(1).first else { continue }
    let b = obs.boundingBox
    print(String(format: "%.4f\t%.4f\t%.4f\t%.4f\t%@",
                 b.origin.x, b.origin.y, b.size.width, b.size.height, cand.string))
}
