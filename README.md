# ReelDL
Chrome extension that sends Facebook reel URLs to a local yt-dlp helper.

## How it works (beginner friendly)
1. The extension adds a right-click menu entry in Chrome called **Download Facebook reel with ReelDL**.
2. When you click it, the extension grabs the best URL it can from your click:
   - A link URL if you clicked a link,
   - A media source URL if you clicked a video,
   - Otherwise the current page URL.
3. The extension sends that URL to a tiny local helper script.
4. The helper runs `yt-dlp` with your browser cookies so it can download the reel.

## Installation (step by step)
1. Open Google Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension` folder inside this repository (`/workspace/ReelDL/extension`).
5. Confirm the extension is listed and enabled in Chrome.

## Native helper setup (required, step by step)
ReelDL now uses `yt-dlp` from your local machine. The Chrome extension only sends the
current Facebook reel URL to a native helper, and the helper runs `yt-dlp`.

1. Download `yt-dlp` from https://github.com/yt-dlp/yt-dlp/releases.
2. Place it next to `reeldl_native_host.py` in the repository root:
   - Windows: name it `yt-dlp.exe`
   - macOS/Linux: name it `yt-dlp`
3. Ensure Python 3.10+ is installed so the helper script can run.
4. Copy `reeldl_native_host.json` to a safe location and update the fields:
   - `path` must be the absolute path to `reeldl_native_host.py`.
   - `allowed_origins` must match your Chrome extension ID.
5. Register the native host manifest with Chrome (Windows example):
   ```powershell
   reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.reeldl.native_host" `
     /ve /t REG_SZ /d "C:\full\path\to\reeldl_native_host.json" /f
   ```
6. Restart Chrome so it can detect the native host.

## Usage (step by step)
1. Navigate to Facebook and open a reel you want to download.
2. Right-click directly on the video area (or anywhere on the reel page).
3. Choose **Download Facebook reel with ReelDL** from the context menu.
4. The native helper runs `yt-dlp --cookies-from-browser chrome <selected-url>`.
5. If no download starts, check that the native host is registered and `yt-dlp`
   is next to `reeldl_native_host.py`.

> Note: Instagram support has been removed for now and may be added later.
