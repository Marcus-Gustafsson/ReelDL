"use strict";

/**
 * @typedef {Object} ContextMenuClickInfo
 * @property {string} menuItemId - The identifier of the clicked context menu item.
 * @property {string} [pageUrl] - The URL of the page where the click happened.
 * @property {string} [linkUrl] - The link URL if the user right-clicked a link.
 * @property {string} [srcUrl] - The media source URL if the user clicked media.
 */

/**
 * @typedef {Object} TabInformation
 * @property {number} id - The numeric identifier for the tab.
 * @property {string} url - The URL currently loaded in the tab.
 * @property {string} [title] - The title of the current tab.
 */

/**
 * @typedef {Object} VideoContextPayload
 * @property {string} pageUrl - The best URL to send to the native helper.
 * @property {string} pageTitle - The document title to help identify the content.
 * @property {string} platformName - The platform or site name derived from the tab URL.
 * @property {ContextMenuClickInfo} clickInformation - Details about the context menu click.
 */

/**
 * @typedef {Object} NativeDownloadRequest
 * @property {"download"} action - The action identifier for the native host.
 * @property {string} pageUrl - The page URL to pass to yt-dlp.
 * @property {string} pageTitle - The page title for logging purposes.
 * @property {string} platformName - The platform name for logging purposes.
 */

/**
 * @typedef {Object} NativeDownloadResponse
 * @property {"ok" | "error"} status - The status from the native host.
 * @property {string} message - A human-readable message about the result.
 */

/**
 * The unique identifier for the context menu entry that this extension creates.
 * @type {string}
 */
const CONTEXT_MENU_IDENTIFIER = "reeldl_download_video";

/**
 * The native messaging host name registered with Chrome.
 * @type {string}
 */
const NATIVE_HOST_NAME = "com.reeldl.native_host";

/**
 * Log debug information in a consistent format for beginners.
 * @param {string} debugMessage - The message to display.
 * @param {unknown} debugPayload - Extra data that helps troubleshooting.
 * @returns {void}
 */
function logDebugInformation(debugMessage, debugPayload) {
  console.info(`[ReelDL][Background] ${debugMessage}`, debugPayload);
}

/**
 * Create a single context menu entry that is visible on every page.
 * @returns {void}
 */
function createContextMenuEntry() {
  // Beginner-friendly note: removeAll prevents duplicate menu entries on reload.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDENTIFIER,
      title: "Download Facebook reel with ReelDL",
      contexts: ["page", "link", "video"]
    });
  });
}

/**
 * Log an error message and optionally show a notification for the user.
 * @param {string} messageToDisplay - The message to log and optionally display.
 * @returns {void}
 */
function reportDownloadError(messageToDisplay) {
  console.error(messageToDisplay);

  // Beginner-friendly note: notifications are optional and require permission.
  if (chrome.notifications && typeof chrome.notifications.create === "function") {
    chrome.notifications.create({
      type: "basic",
      iconUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA" +
        "AAC0lEQVR42mP8/5+hHgAFgwJ/lYv5WAAAAABJRU5ErkJggg==",
      title: "ReelDL download",
      message: messageToDisplay
    });
  }
}

/**
 * Build the native messaging payload that tells the helper to run yt-dlp.
 * @param {VideoContextPayload} videoContextPayload - The details about the page.
 * @returns {NativeDownloadRequest}
 */
function buildNativeDownloadRequest(videoContextPayload) {
  return {
    action: "download",
    pageUrl: videoContextPayload.pageUrl,
    pageTitle: videoContextPayload.pageTitle,
    platformName: videoContextPayload.platformName
  };
}

/**
 * Extract a hostname from a URL string, or fall back to facebook.com.
 * @param {string} urlToParse - The URL to parse.
 * @returns {string}
 */
function extractHostnameOrFallback(urlToParse) {
  if (!urlToParse) {
    return "facebook.com";
  }

  try {
    return new URL(urlToParse).hostname;
  } catch (error) {
    return "facebook.com";
  }
}

/**
 * Select the most useful URL for yt-dlp based on the click context.
 * @param {ContextMenuClickInfo} clickInformation - Details about the click.
 * @param {TabInformation} tabInformation - Details about the current tab.
 * @returns {string}
 */
function selectReelUrl(clickInformation, tabInformation) {
  const linkUrl =
    typeof clickInformation.linkUrl === "string"
      ? clickInformation.linkUrl
      : "";
  const sourceUrl =
    typeof clickInformation.srcUrl === "string"
      ? clickInformation.srcUrl
      : "";
  const pageUrl =
    typeof clickInformation.pageUrl === "string"
      ? clickInformation.pageUrl
      : "";
  const tabUrl = typeof tabInformation.url === "string" ? tabInformation.url : "";

  // Beginner-friendly note: prefer explicit URLs from the click event.
  return linkUrl || sourceUrl || pageUrl || tabUrl;
}

/**
 * Send a native message to the local helper and wait for its response.
 * @param {NativeDownloadRequest} nativeDownloadRequest - The request to send.
 * @returns {Promise<NativeDownloadResponse | null>}
 */
function sendDownloadRequestToNativeHost(nativeDownloadRequest) {
  return new Promise((resolve) => {
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      nativeDownloadRequest,
      (response) => {
        if (chrome.runtime.lastError) {
          logDebugInformation("Native host request failed.", {
            errorMessage: chrome.runtime.lastError.message
          });
          resolve(null);
          return;
        }

        if (
          typeof response === "object" &&
          response !== null &&
          typeof response.status === "string"
        ) {
          resolve(response);
          return;
        }

        resolve(null);
      }
    );
  });
}

/**
 * Begin a download for the provided video context data.
 * @param {VideoContextPayload} videoContextPayload - The details about the page.
 * @returns {Promise<void>}
 */
async function startDownloadFromContext(videoContextPayload) {
  if (!videoContextPayload.pageUrl) {
    reportDownloadError("ReelDL could not find the current page URL.");
    return;
  }

  const nativeDownloadRequest = buildNativeDownloadRequest(
    videoContextPayload
  );

  logDebugInformation("Sending download request to native host.", {
    nativeDownloadRequest
  });

  const nativeDownloadResponse = await sendDownloadRequestToNativeHost(
    nativeDownloadRequest
  );

  if (!nativeDownloadResponse) {
    reportDownloadError(
      "ReelDL could not reach the yt-dlp helper. Make sure it is installed."
    );
    return;
  }

  if (nativeDownloadResponse.status !== "ok") {
    reportDownloadError(
      nativeDownloadResponse.message ||
        "ReelDL could not start yt-dlp. Check the helper logs."
    );
  }
}

/**
 * Handle a click on the ReelDL context menu entry.
 * @param {ContextMenuClickInfo} clickInformation - Details about the context menu click.
 * @param {TabInformation} tabInformation - The tab where the click occurred.
 * @returns {void}
 */
async function handleContextMenuClick(clickInformation, tabInformation) {
  if (clickInformation.menuItemId !== CONTEXT_MENU_IDENTIFIER) {
    return;
  }

  if (!tabInformation?.id) {
    reportDownloadError("ReelDL could not find the active tab.");
    return;
  }

  const selectedPageUrl = selectReelUrl(clickInformation, tabInformation);
  const videoContextPayload = {
    pageUrl: selectedPageUrl,
    pageTitle: tabInformation.title || "Facebook Reel",
    platformName: extractHostnameOrFallback(tabInformation.url || ""),
    clickInformation
  };

  logDebugInformation("Prepared download payload from context click.", {
    selectedPageUrl
  });

  await startDownloadFromContext(videoContextPayload);
}

/**
 * Initialize the background service worker when the extension is installed.
 * @returns {void}
 */
function registerExtensionHandlers() {
  createContextMenuEntry();

  // Beginner-friendly note: listen for clicks on our context menu entry.
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}

chrome.runtime.onInstalled.addListener(registerExtensionHandlers);
