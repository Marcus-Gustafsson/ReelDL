# ReelDL
Chrome extension that sends Facebook reel URLs to a local yt-dlp helper.

## Installation
1. Open Google Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension` folder inside this repository (`/workspace/ReelDL/extension`).
5. Confirm the extension is listed and enabled in Chrome.

## Native helper setup (required)
ReelDL now uses `yt-dlp` from your local machine. The Chrome extension only sends the
current Facebook reel URL to a native helper, and the helper runs `yt-dlp`.

1. Download `yt-dlp.exe` and place it in the repository root (`/workspace/ReelDL/yt-dlp.exe`).
2. Ensure Python 3.10+ is installed so the helper script can run.
3. Copy `reeldl_native_host.json` to a safe location and update the fields:
   - `path` must be the absolute path to `reeldl_native_host.py`.
   - `allowed_origins` must match your Chrome extension ID.
4. Register the native host manifest with Chrome (Windows example):
   ```powershell
   reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.reeldl.native_host" `
     /ve /t REG_SZ /d "C:\full\path\to\reeldl_native_host.json" /f
   ```
5. Restart Chrome so it can detect the native host.

## Usage
1. Navigate to Facebook and open a reel you want to download.
2. Right-click directly on the video area.
3. Choose **Download Facebook reel with ReelDL** from the context menu.
4. The native helper runs `yt-dlp --cookies-from-browser chrome <current-url>`.
5. If no download starts, check that the native host is registered and `yt-dlp.exe`
   is in the repository root.

> Note: Instagram support has been removed for now and may be added later.
