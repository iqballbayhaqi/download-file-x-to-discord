/**
 * Fetch tweet media using the FxTwitter API.
 * API docs: https://github.com/FixTweet/FxTwitter
 *
 * Endpoint: https://api.fxtwitter.com/{username}/status/{tweetId}
 * Returns JSON with tweet data including media URLs.
 */

async function fetchTweetMedia(username, tweetId) {
  const apiUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "TwitterToDiscordBot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `FxTwitter API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data.tweet) {
    throw new Error("Tweet tidak ditemukan");
  }

  const tweet = data.tweet;
  const result = {
    text: tweet.text || "",
    author: tweet.author?.name || username,
    authorHandle: tweet.author?.screen_name || username,
    media: [],
  };

  // Extract photos
  if (tweet.media?.photos) {
    for (const photo of tweet.media.photos) {
      result.media.push({
        type: "photo",
        url: photo.url,
        filename: `photo_${result.media.length + 1}.jpg`,
      });
    }
  }

  // Extract videos
  if (tweet.media?.videos) {
    for (const video of tweet.media.videos) {
      result.media.push({
        type: "video",
        url: video.url,
        filename: `video_${result.media.length + 1}.mp4`,
      });
    }
  }

  // Extract GIFs (FxTwitter returns them under videos with type gif)
  // They are already captured above if present

  return result;
}

module.exports = { fetchTweetMedia };
