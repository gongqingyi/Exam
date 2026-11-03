import AppKit
import Foundation
import Vision

struct OCRLine: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRResult: Codable {
    let image: String
    let lines: [OCRLine]
}

func recognize(_ imageURL: URL) throws -> OCRResult {
    guard let image = NSImage(contentsOf: imageURL),
          let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let cgImage = bitmap.cgImage
    else {
        throw NSError(
            domain: "OCR",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Cannot decode \(imageURL.path)"]
        )
    }

    var observations: [VNRecognizedTextObservation] = []
    let request = VNRecognizeTextRequest { request, error in
        if let error {
            fputs("Vision error: \(error)\n", stderr)
            return
        }
        observations = request.results as? [VNRecognizedTextObservation] ?? []
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.minimumTextHeight = 0.006

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let lines = observations.compactMap { observation -> OCRLine? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return OCRLine(
            text: candidate.string,
            confidence: candidate.confidence,
            x: box.origin.x,
            y: box.origin.y,
            width: box.width,
            height: box.height
        )
    }.sorted {
        let rowTolerance = max($0.height, $1.height) * 0.55
        if abs($0.y - $1.y) > rowTolerance {
            return $0.y > $1.y
        }
        return $0.x < $1.x
    }

    return OCRResult(image: imageURL.path, lines: lines)
}

let arguments = CommandLine.arguments.dropFirst()
guard !arguments.isEmpty else {
    fputs("Usage: ocr.swift IMAGE [IMAGE ...]\n", stderr)
    exit(2)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

for argument in arguments {
    let imageURL = URL(fileURLWithPath: argument)
    do {
        let result = try recognize(imageURL)
        let jsonURL = imageURL.deletingPathExtension().appendingPathExtension("ocr.json")
        let textURL = imageURL.deletingPathExtension().appendingPathExtension("ocr.txt")
        try encoder.encode(result).write(to: jsonURL)
        let text = result.lines.map(\.text).joined(separator: "\n") + "\n"
        try text.write(to: textURL, atomically: true, encoding: .utf8)
        print("OCR: \(imageURL.lastPathComponent) -> \(result.lines.count) lines")
    } catch {
        fputs("OCR failed for \(argument): \(error)\n", stderr)
        exit(1)
    }
}
