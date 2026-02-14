/**
 * Parse a Twitter/X URL and extract the tweet ID and username.
 *
 * Supports formats:
 *  - https://twitter.com/username/status/1234567890
 *  - https://x.com/username/status/1234567890
 *  - https://mobile.twitter.com/username/status/1234567890
 *  - With or without query params (?s=20, etc.)
 */

function parseTweetUrl(url) {
  try {
    const parsed = new URL(url.trim());
    const validHosts = [
      "twitter.com",
      "x.com",
      "mobile.twitter.com",
      "www.twitter.com",
      "www.x.com",
    ];

    if (!validHosts.includes(parsed.hostname)) {
      return {
        error:
          "URL bukan dari Twitter/X. Gunakan link dari twitter.com atau x.com",
      };
    }

    // pathname: /username/status/1234567890
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parts.length < 3 || parts[1] !== "status") {
      return {
        error: "Format URL tidak valid. Pastikan URL berisi /status/tweet_id",
      };
    }

    const username = parts[0];
    const tweetId = parts[2];

    if (!/^\d+$/.test(tweetId)) {
      return { error: "Tweet ID tidak valid" };
    }

    return { username, tweetId };
  } catch {
    return { error: "URL tidak valid" };
  }
}

module.exports = { parseTweetUrl };
