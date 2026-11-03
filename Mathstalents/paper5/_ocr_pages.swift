import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("usage: ocr <image> [...]\n", stderr)
    exit(1)
}

for path in args.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let img = NSImage(contentsOf: url),
          let tiff = img.tiffRepresentation,
          let ci = CIImage(data: tiff) else {
        print("==== FAIL \(path) ====")
        continue
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
    request.usesLanguageCorrection = false
    let handler = VNImageRequestHandler(ciImage: ci, options: [:])
    try handler.perform([request])
    let observations = request.results ?? []
    print("==== \(url.lastPathComponent) ====")
    for obs in observations {
        if let cand = obs.topCandidates(1).first {
            print(cand.string)
        }
    }
    print("")
}
