const { WebhookClient, AttachmentBuilder } = require("discord.js");
const { compressVideo } = require("./videoCompressor");

/**
 * Download a file from a URL and return it as a Buffer.
 */
async function downloadFile(url) {
  console.log(`DEBUG: Downloading ${url}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TwitterToDiscordBot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${url} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`DEBUG: Download complete. Size: ${buffer.length} bytes`);
  return buffer;
}

/**
 * Send media files to Discord via Webhook.
 * Implements Adaptive Limit Strategy: Starts at 24MB, downgrades on 40005 error.
 *
 * @param {Array<{type: string, url: string, filename: string}>} mediaItems
 * @param {string} tweetUrl
 * @param {string} tweetText
 * @param {string} author
 * @param {string} authorHandle
 * @param {string} authorHandle
 * @param {function} onProgress
 * @param {string} webhookUrl (optional)
 * @param {boolean} allowCompression (optional, default true)
 */
async function sendToDiscord(
  mediaItems,
  tweetUrl,
  tweetText,
  author,
  authorHandle,
  onProgress = () => {},
  webhookUrl = null,
  allowCompression = true,
) {
  const finalWebhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;

  if (!finalWebhookUrl) {
    throw new Error(
      "Webhook URL belum diatur! Silakan atur di menu pengaturan.",
    );
  }

  const webhookClient = new WebhookClient(
    { url: finalWebhookUrl },
    { rest: { timeout: 60000 } },
  );

  // Adaptive Limit Strategy
  const LIMITS = [24, 20, 15, 10, 8, 7, 5].map((x) => x * 1024 * 1024);
  let currentLimitIndex = 0;

  const largeFiles = [];
  const results = [];

  // 1. Download ALL files first to memory (to allow retries/re-compression)
  // Note: For very large number of files, this might need streaming, but for tweets (max 4), memory is fine.
  onProgress(10, `Menyiapkan ${mediaItems.length} media...`);
  const loadedItems = [];

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    const progress = 10 + Math.floor(((i + 1) / mediaItems.length) * 20);
    onProgress(progress, `Mendownload media ${i + 1}/${mediaItems.length}...`);

    try {
      const buffer = await downloadFile(item.url);
      loadedItems.push({
        ...item,
        originalBuffer: buffer,
        currentBuffer: buffer,
      });
    } catch (err) {
      console.error(`Error downloading ${item.url}:`, err);
    }
  }

  // 2. Process and Send Batches with Adaptive Limit
  let processedCount = 0;
  let batchIndex = 0;

  while (processedCount < loadedItems.length) {
    const MAX_SIZE_BYTES = LIMITS[currentLimitIndex];
    const currentLimitMB = (MAX_SIZE_BYTES / 1024 / 1024).toFixed(0);
    console.log(
      `DEBUG: Current Limit: ${currentLimitMB} MB (Index: ${currentLimitIndex})`,
    );

    const batch = { files: [], size: 0, items: [] };
    const batchStartIndex = processedCount;
    let batchReadyToSend = false;

    // Try to pack a batch
    for (let i = processedCount; i < loadedItems.length; i++) {
      const item = loadedItems[i];
      let buffer = item.currentBuffer;

      // Video Compression Check against CURRENT limit
      if (
        allowCompression &&
        item.type === "video" &&
        buffer.length > MAX_SIZE_BYTES
      ) {
        console.log(
          `⚠️ Video ${item.filename} (${(buffer.length / 1024 / 1024).toFixed(2)}MB) > Limit ${currentLimitMB}MB. Compressing...`,
        );
        onProgress(
          30 + i * 10,
          `Mengompres video ${item.filename} ke ${currentLimitMB}MB...`,
        );

        try {
          // Always compress from original buffer to minimize generation loss
          const compressed = await compressVideo(
            item.originalBuffer,
            MAX_SIZE_BYTES,
          );

          if (compressed.length < MAX_SIZE_BYTES * 1.05) {
            // 5% margin
            console.log(
              `✅ Compressed to ${(compressed.length / 1024 / 1024).toFixed(2)}MB`,
            );
            item.currentBuffer = compressed;
            item.filename = item.filename.replace(".mp4", "_compressed.mp4");
            buffer = compressed;
          } else {
            console.warn(
              `⚠️ Compression result ${(compressed.length / 1024 / 1024).toFixed(2)}MB still > ${currentLimitMB}MB`,
            );
          }
        } catch (e) {
          console.error(`❌ Compression failed: ${e.message}`);
        }
      }

      // If still too large after compression attempt (or if compression was skipped)
      if (buffer.length > MAX_SIZE_BYTES) {
        if (!allowCompression) {
          // Immediately fallback to link
          console.log(
            `DEBUG: File > Limit and Compression disabled. Sending link.`,
          );
          largeFiles.push(item);
          processedCount++; // Skip this file as if processed
          continue; // Skip to next item in loop
        }

        // Existing downgrade logic for when compression IS allowed but failed
        if (currentLimitIndex < LIMITS.length - 1) {
          console.log(
            `DEBUG: File > Current Limit. Downgrading limit to try harder compression...`,
          );
          currentLimitIndex++;
          processedCount = batchStartIndex; // Restart this batch with stricter limit
          batchReadyToSend = false;
          break; // Break inner loop, restart outer while loop
        } else {
          // Final fail
          console.log(`DEBUG: File > 5MB Limit. Giving up on file.`);
          largeFiles.push(item);
          processedCount++; // Skip this file
          continue;
        }
      }

      // Check if fits in batch
      if (
        batch.size + buffer.length > MAX_SIZE_BYTES &&
        batch.files.length > 0
      ) {
        // Batch full.
        batchReadyToSend = true;
        break;
      }

      batch.files.push(new AttachmentBuilder(buffer, { name: item.filename }));
      batch.size += buffer.length;
      batch.items.push(item);

      // If last item, batch is ready
      if (i === loadedItems.length - 1) {
        batchReadyToSend = true;
        processedCount = i + 1; // Mark all as processed for now (will be reverted if send fails)
      } else {
        processedCount++;
      }
    }

    if (!batchReadyToSend && batch.files.length > 0) {
      // Should be covered by "last item" check, but safety net
      batchReadyToSend = true;
    }

    if (batchReadyToSend && batch.files.length > 0) {
      batchIndex++;
      console.log(
        `  📤 Sending batch ${batchIndex} (${(batch.size / 1024 / 1024).toFixed(2)} MB)...`,
      );
      onProgress(50 + batchIndex * 10, `Mengupload batch ${batchIndex}...`);

      let content =
        batchIndex === 1
          ? `📨 **Tweet dari @${authorHandle}** (${author})\n${tweetText ? `> ${tweetText}\n` : ""}🔗 ${tweetUrl}`
          : `📨 Media lanjutan (batch ${batchIndex})`;

      try {
        await webhookClient.send({ content, files: batch.files });
        results.push({ batch: batchIndex, stats: "sent" });
        console.log(`✅ Batch ${batchIndex} sent!`);

        // DO NOT reset processedCount here, it was incremented in loop
      } catch (error) {
        console.error(`❌ Send failed: ${error.message}`);

        // Check for "Too Large" error
        if (
          error.code === 40005 ||
          error.status === 413 ||
          error.message.includes("too large")
        ) {
          if (currentLimitIndex < LIMITS.length - 1) {
            console.log(
              `⚠️ Batch rejected (Too Large). Downgrading limit from ${currentLimitMB}MB to ${(LIMITS[currentLimitIndex + 1] / 1024 / 1024).toFixed(0)}MB.`,
            );
            currentLimitIndex++;
            processedCount = batchStartIndex; // REVERT progress to retry batch
            batchIndex--; // Revert batch count
            continue; // Retry loop
          } else {
            console.error(`❌ Failed even at 5MB limit. Skipping batch.`);
            // Maybe add to largeFiles?
            largeFiles.push(...batch.items);
          }
        } else {
          // Other error (e.g. timeout)
          throw error;
        }
      }
    }
  }

  // 3. Handle Large Files
  if (largeFiles.length > 0) {
    const largeFilesContent = largeFiles
      .map((item) => `⚠️ **File > 5MB**:\n${item.url}`)
      .join("\n\n");
    const message =
      results.length === 0
        ? `📨 **Tweet dari @${authorHandle}** (${author})\n${tweetText ? `> ${tweetText}\n` : ""}🔗 ${tweetUrl}\n\n${largeFilesContent}`
        : `📨 File besar tambahan:\n${largeFilesContent}`;

    try {
      await webhookClient.send({ content: message });
      results.push({
        status: "large_files_links_sent",
        count: largeFiles.length,
      });
    } catch (e) {
      console.error(e);
    }
  }

  onProgress(100, "Selesai!");
  return results;
}

module.exports = { sendToDiscord };
