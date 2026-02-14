# 🤖 Bot X to Discord

A powerful and user-friendly tool to send media (Videos, Images) from Twitter/X directly to your Discord channel via Webhooks.

![Preview](https://via.placeholder.com/800x400?text=Bot+X+to+Discord+Preview)

## ✨ Features

- **🚀 Seamless Integration**: Paste a Twitter/X link, and the bot fetches and sends the media to Discord.
- **⚙️ Dynamic Configuration**: Configure your Discord Webhook URL directly from the simple Settings UI—no server restart required!
- **🎬 Smart Video Compression**: Automatically compresses large videos to fit Discord's file size limits (8MB/25MB/etc.).
- **🎛️ Compression Toggle**: Choose whether to compress videos or send direct links for higher quality.
- **📥 Secure Downloads**: Download media from your history safely using a built-in proxy (bypasses 403 Forbidden errors).
- **Fa History Tracking**: keeps a local history of sent tweets with download links.
- **📱 Responsive UI**: Clean and modern interface that works great on desktop and mobile.

## 🛠️ Prerequisites

- **Node.js**: v18 or higher (v20+ recommended for `--watch` mode).
- **Yarn**: Preferred package manager (or npm).

## � Installation & Setup

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/iqballbayhaqi/bot-x-to-discord.git
    cd bot-x-to-discord
    ```

2.  **Install Dependencies**

    ```bash
    yarn install
    ```

3.  **Environment Variables (Optional)**
    You can set a default webhook URL in a `.env` file, but it's easier to use the UI settings.

    ```bash
    cp .env.example .env
    # Edit .env to set PORT if needed (Optional)
    ```

4.  **Run the Server**
    ```bash
    yarn dev
    ```
    This runs the server in watch mode (`node --watch`), so it automatically restarts on file changes.

## 📖 Usage

1.  Open your browser and navigate to `http://localhost:3000`.
2.  **First Time Setup**:
    - Click the **Settings (⚙️)** icon in the top right.
    - Paste your **Discord Webhook URL**.
    - (Optional) Toggle "Allow Automatic Compression".
    - Click **Save**.
3.  **Send a Tweet**:
    - Paste a Twitter/X post URL into the input field.
    - Click **Process**.
    - Watch the progress bar as it fetches, downloads, compresses (if needed), and sends to Discord.
4.  **History & Downloads**:
    - Scroll down to see your sent history.
    - Click the **Download** buttons to save media to your device.

## � Technical Details

- **Frontend**: HTML5, CSS3, Vanilla JavaScript.
- **Backend**: Node.js, Express.
- **Media Processing**: `ffmpeg-static` for reliable video compression.
- **API**: Uses `FxTwitter` (FixupX) API to resolve tweet media.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).

## 👤 Author

Built by [Iqbal Bayhaqi](https://github.com/iqballbayhaqi).
