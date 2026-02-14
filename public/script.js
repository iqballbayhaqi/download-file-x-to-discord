const form = document.getElementById("tweet-form");
const input = document.getElementById("tweet-url");
const submitBtn = document.getElementById("submit-btn");
const resultDiv = document.getElementById("result");
const resultContent = resultDiv.querySelector(".result-content");
const historyList = document.getElementById("history-list");

// Progress elements
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

// Settings elements
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeModalBtn = document.getElementById("close-modal");
const saveSettingsBtn = document.getElementById("save-settings");
const webhookInput = document.getElementById("webhook-url");
const compressionInput = document.getElementById("allow-compression");

// Load settings
let discordWebhook = localStorage.getItem("discordWebhook") || "";
let allowCompression = localStorage.getItem("allowCompression") !== "false"; // Default true

webhookInput.value = discordWebhook;
compressionInput.checked = allowCompression;

// Show settings if no webhook is set
if (!discordWebhook) {
  settingsModal.classList.remove("hidden");
}

// Load history from localStorage
let history = JSON.parse(localStorage.getItem("tweetHistory") || "[]");
renderHistory();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const url = input.value.trim();
  if (!url) return;

  // Reset UI
  submitBtn.classList.add("loading");
  submitBtn.disabled = true;
  resultDiv.classList.add("hidden");
  resultDiv.className = "result hidden"; // Reset classes

  // Show progress
  progressContainer.classList.remove("hidden");
  updateProgress(0, "Menghubungkan...");

  // Get current webhook from local storage (or input value)
  const webhook = localStorage.getItem("discordWebhook");

  if (!webhook) {
    updateProgress(0, "Error: Webhook belum diset!");
    showResult(
      "error",
      "Silakan atur Discord Webhook URL di pengaturan (ikon gerigi).",
    );
    progressContainer.classList.add("hidden");
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
    settingsModal.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch(
      `/api/send?url=${encodeURIComponent(url)}&webhook=${encodeURIComponent(webhook)}&compress=${allowCompression}`,
    );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let resultData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.substring(6));

            if (data.status === "progress") {
              updateProgress(data.percent, data.message);
            } else if (data.status === "success") {
              resultData = data;
              updateProgress(100, "Selesai!");
            } else if (data.status === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") {
              // Ignore partial JSON chunks if any
              if (resultData) break; // If already success, stop
              if (line.includes('"status":"error"'))
                throw new Error("Error parsing stream");
            }
          }
        }
      }
    }

    if (!resultData) {
      throw new Error("Tidak ada respon dari server");
    }

    // Success styling
    progressBar.style.backgroundColor = "var(--accent-green)";
    setTimeout(() => {
      progressContainer.classList.add("hidden");
      progressBar.style.width = "0%";
      progressBar.style.backgroundColor = ""; // Reset color
    }, 2000);

    const data = resultData;

    // Show success result
    const mediaTypesHtml = data.tweet.mediaTypes
      .map(
        (type) =>
          `<span class="media-tag ${type}">${type === "photo" ? "🖼️" : "🎬"} ${type}</span>`,
      )
      .join("");

    showResult(
      "success",
      `
      <div class="result-header">
        <span class="result-icon">✅</span>
        <span class="result-title">${data.message}</span>
      </div>
      <div class="result-details">
        <strong>@${data.tweet.authorHandle}</strong> (${data.tweet.author})<br>
        ${data.tweet.text ? `"${data.tweet.text.substring(0, 120)}${data.tweet.text.length > 120 ? "..." : ""}"` : ""}
        <div class="media-tags">${mediaTypesHtml}</div>
      </div>
    `,
    );

    // Add to history
    addToHistory({
      author: data.tweet.author,
      authorHandle: data.tweet.authorHandle,
      mediaCount: data.tweet.mediaCount,
      mediaTypes: data.tweet.mediaTypes,
      media: data.tweet.media, // Save media URLs
      time: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    // Clear input
    input.value = "";
  } catch (err) {
    showResult("error", err.message || "Gagal terhubung ke server");
    progressContainer.classList.add("hidden");
  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
  }
});

function updateProgress(percent, message) {
  progressBar.style.width = `${percent}%`;
  progressText.textContent = message || `${percent}%`;
}

function showResult(type, html) {
  resultDiv.className = `result ${type}`;
  if (type === "error") {
    resultContent.innerHTML = `
      <div class="result-header">
        <span class="result-icon">❌</span>
        <span class="result-title">${html}</span>
      </div>
    `;
  } else {
    resultContent.innerHTML = html;
  }
}

function addToHistory(item) {
  history.unshift(item);
  if (history.length > 20) history.pop();
  localStorage.setItem("tweetHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML =
      '<p class="empty-state">Belum ada riwayat pengiriman</p>';
    return;
  }

  historyList.innerHTML = history
    .map((item) => {
      // Generate download links
      let downloadLinksHtml = "";
      if (item.media && item.media.length > 0) {
        downloadLinksHtml = `<div class="history-downloads">`;
        item.media.forEach((media, index) => {
          const icon = media.type === "video" ? "🎬" : "🖼️";
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(media.url)}`;
          downloadLinksHtml += `
            <a href="${proxyUrl}" class="download-link" title="Download Media ${index + 1}">
              ${icon} Download ${index + 1}
            </a>`;
        });
        downloadLinksHtml += `</div>`;
      }

      return `
      <div class="history-item">
        <span class="history-status">✅</span>
        <div class="history-info">
          <div class="history-author">@${item.authorHandle} — ${item.author}</div>
          <div class="history-meta">${item.mediaCount} media (${item.mediaTypes.join(", ")})</div>
          ${downloadLinksHtml}
        </div>
        <span class="history-time">${item.time}</span>
      </div>
    `;
    })
    .join("");
}

// Auto-focus input
input.focus();

// ==============================
// Settings Modal Logic
// ==============================

settingsBtn.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

// Close modal when clicking outside
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add("hidden");
  }
});

saveSettingsBtn.addEventListener("click", () => {
  const newWebhook = webhookInput.value.trim();
  const newCompression = compressionInput.checked;

  if (newWebhook) {
    localStorage.setItem("discordWebhook", newWebhook);
    localStorage.setItem("allowCompression", newCompression);

    discordWebhook = newWebhook;
    allowCompression = newCompression;

    settingsModal.classList.add("hidden");
    // Show temporary success feedback on the button or general toast if needed
    // For now, just closing is fine.
  } else {
    alert("Silakan masukkan URL Webhook yang valid.");
  }
});
