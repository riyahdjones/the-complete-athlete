import AVFoundation
import AudioToolbox
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift extract_game_day_audio.swift input.mov output.m4a\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
try? FileManager.default.removeItem(at: outputURL)

let asset = AVURLAsset(url: inputURL)
let audioTracks = try await asset.loadTracks(withMediaType: .audio)
guard !audioTracks.isEmpty else {
    fputs("The supplied recording does not contain an audio track.\n", stderr)
    exit(1)
}
let duration = try await asset.load(.duration)
let maximumDuration = CMTime(seconds: 60, preferredTimescale: 600)
let exportDuration = CMTimeMinimum(duration, maximumDuration)
let reader = try AVAssetReader(asset: asset)
reader.timeRange = CMTimeRange(start: .zero, duration: exportDuration)
let readerOutput = AVAssetReaderTrackOutput(track: audioTracks[0], outputSettings: nil)
guard reader.canAdd(readerOutput) else {
    fputs("Unable to decode the recording's audio track.\n", stderr)
    exit(1)
}
reader.add(readerOutput)

let outputType: AVFileType = outputURL.pathExtension.lowercased() == "mp4" ? .mp4 : .m4a
let writer = try AVAssetWriter(outputURL: outputURL, fileType: outputType)
let formatDescriptions = try await audioTracks[0].load(.formatDescriptions)
let writerInput = AVAssetWriterInput(mediaType: .audio, outputSettings: nil, sourceFormatHint: formatDescriptions.first)
guard writer.canAdd(writerInput) else {
    fputs("Unable to create the app audio track.\n", stderr)
    exit(1)
}
writer.add(writerInput)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
reader.startReading()

while reader.status == .reading {
    if writerInput.isReadyForMoreMediaData, let buffer = readerOutput.copyNextSampleBuffer() {
        if !writerInput.append(buffer) { break }
    } else {
        try await Task.sleep(for: .milliseconds(2))
    }
}
writerInput.markAsFinished()
await writer.finishWriting()

guard reader.status == .completed, writer.status == .completed else {
    fputs("Audio conversion failed: \(reader.error?.localizedDescription ?? writer.error?.localizedDescription ?? "unknown error")\n", stderr)
    exit(1)
}
print("Exported \(CMTimeGetSeconds(exportDuration)) seconds to \(outputURL.path)")
