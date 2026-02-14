const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static");
const { Readable, Writable } = require("stream");
const path = require("path");
const os = require("os");
const fs = require("fs");

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath && ffprobePath.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

/**
 * Compress a video buffer to a target size (default 24MB).
 * Returns a buffer of the compressed video.
 *
 * @param {Buffer} inputBuffer - The original video buffer
 * @param {number} targetSizeBytes - Target size in bytes (default 24MB)
 * @param {function} onProgress - Callback for progress (percent)
 * @returns {Promise<Buffer>}
 */
async function compressVideo(
  inputBuffer,
  targetSizeBytes = 24 * 1024 * 1024,
  onProgress = () => {},
) {
  return new Promise((resolve, reject) => {
    // We need to write buffer to temp file because fluent-ffmpeg with buffers is tricky/unstable for seeking/probing
    const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
    const tempOutputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);

    fs.writeFileSync(tempInputPath, inputBuffer);

    // probe file to get duration
    ffmpeg.ffprobe(tempInputPath, (err, metadata) => {
      if (err) {
        fs.unlinkSync(tempInputPath);
        return reject(new Error("Failed to probe video: " + err.message));
      }

      const duration = metadata.format.duration;
      if (!duration) {
        fs.unlinkSync(tempInputPath);
        return reject(new Error("Could not determine video duration"));
      }

      // Calculate target bitrate
      // Size = (Video Bitrate + Audio Bitrate) * Duration / 8
      // We reserve ~128k for audio
      const audioBitrate = 128 * 1024; // 128 kbps
      const targetTotalBitrate = (targetSizeBytes * 8) / duration;
      const targetVideoBitrate = Math.max(
        100 * 1024,
        targetTotalBitrate - audioBitrate,
      ); // Min 100kbps

      const durationMinutes = Math.floor(duration / 60);
      const durationSeconds = (duration % 60).toFixed(0);

      console.log(
        `🎬 Compressing video. Duration: ${durationMinutes}m ${durationSeconds}s. Target size: ${(
          targetSizeBytes /
          1024 /
          1024
        ).toFixed(2)}MB`,
      );
      console.log(
        `📉 Target Video Bitrate: ${(targetVideoBitrate / 1024).toFixed(0)}k`,
      );

      ffmpeg(tempInputPath)
        .outputOptions([
          `-b:v ${targetVideoBitrate}`,
          `-maxrate ${targetVideoBitrate * 1.5}`,
          `-bufsize ${targetVideoBitrate * 2}`,
          `-b:a 128k`,
          "-vf scale=-2:720", // Downscale to 720p if higher, maintain aspect ratio
          "-c:v libx264",
          "-preset fast",
          "-crf 28", // Fallback constant quality if bitrate targets fail or for simple compression
        ])
        .output(tempOutputPath)
        .on("progress", (progress) => {
          if (progress.percent) {
            onProgress(Math.min(99, Math.round(progress.percent)));
          }
        })
        .on("end", () => {
          try {
            const compressedBuffer = fs.readFileSync(tempOutputPath);

            // Cleanup
            fs.unlinkSync(tempInputPath);
            fs.unlinkSync(tempOutputPath);

            console.log(
              `✅ Compression finished. New size: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`,
            );
            resolve(compressedBuffer);
          } catch (e) {
            reject(e);
          }
        })
        .on("error", (err) => {
          // Cleanup
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
          reject(new Error("Compression failed: " + err.message));
        })
        .run();
    });
  });
}

module.exports = { compressVideo };
