"use strict";

/**
 * @typedef {Object} ContextMenuClickInfo
 * @property {string} menuItemId - The identifier of the clicked context menu item.
 * @property {string} [pageUrl] - The URL of the page where the click happened.
 */

/**
 * @typedef {Object} TabInformation
 * @property {number} id - The numeric identifier for the tab.
 * @property {string} url - The URL currently loaded in the tab.
 */

/**
 * @typedef {Object} VideoContextPayload
 * @property {string | null} videoUrl - The extracted video URL, when available.
 * @property {string} pageTitle - The document title to help identify the content.
 * @property {string} platformName - The platform or site name derived from metadata.
 * @property {string} requestId - The identifier for the request-response cycle.
 */

/**
 * The unique identifier for the context menu entry that this extension creates.
 * @type {string}
 */
const CONTEXT_MENU_IDENTIFIER = "reeldl_download_video";

/**
 * The message type used to ask the content script for video details.
 * @type {string}
 */
const VIDEO_CONTEXT_REQUEST_TYPE = "VIDEO_CONTEXT_REQUEST";

/**
 * The message type used by the content script to respond with video details.
 * @type {string}
 */
const VIDEO_CONTEXT_RESPONSE_TYPE = "VIDEO_CONTEXT_RESPONSE";

/**
 * The fallback file extension for downloads.
 * @type {string}
 */
const DEFAULT_VIDEO_EXTENSION = "mp4";

/**
 * The maximum time (in milliseconds) to wait for a content script response.
 * @type {number}
 */
const RESPONSE_TIMEOUT_IN_MILLISECONDS = 3000;

/**
 * Create a single context menu entry that is visible on every page.
 * @returns {void}
 */
function createContextMenuEntry() {
  // Beginner-friendly note: removeAll prevents duplicate menu entries on reload.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDENTIFIER,
      title: "Download video with ReelDL",
      contexts: ["page"]
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
 * Create a safe, beginner-friendly filename for the download.
 * @param {VideoContextPayload} videoContextPayload - The details from the content script.
 * @returns {string}
 */
function buildDownloadFilename(videoContextPayload) {
  const safePlatformName = sanitizeFilenameSegment(
    videoContextPayload.platformName
  );
  const safePageTitle = sanitizeFilenameSegment(videoContextPayload.pageTitle);
  const timestampForFilename = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const filenameParts = [
    safePlatformName || "platform",
    safePageTitle || "video",
    timestampForFilename
  ];

  return `${filenameParts.join("-")}.${DEFAULT_VIDEO_EXTENSION}`;
}

/**
 * Replace unsafe filename characters with hyphens for easy reading.
 * @param {string} valueToSanitize - The value that should become filename-safe.
 * @returns {string}
 */
function sanitizeFilenameSegment(valueToSanitize) {
  return valueToSanitize
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Request video context data from the active tab's content script.
 * @param {number} tabId - The identifier of the active tab.
 * @returns {Promise<VideoContextPayload | null>}
 */
function requestVideoContextFromTab(tabId) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve) => {
    const responseTimeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handleResponseMessage);
      resolve(null);
    }, RESPONSE_TIMEOUT_IN_MILLISECONDS);

    /**
     * Handle incoming responses from the content script.
     * @param {unknown} message - The message sent from the content script.
     * @param {chrome.runtime.MessageSender} sender - The sender details.
     * @returns {void}
     */
    function handleResponseMessage(message, sender) {
      if (
        sender.tab?.id === tabId &&
        typeof message === "object" &&
        message !== null &&
        message.type === VIDEO_CONTEXT_RESPONSE_TYPE &&
        message.payload?.requestId === requestId
      ) {
        clearTimeout(responseTimeout);
        chrome.runtime.onMessage.removeListener(handleResponseMessage);
        resolve(message.payload);
      }
    }

    chrome.runtime.onMessage.addListener(handleResponseMessage);

    // Beginner-friendly note: we ask the content script for video details.
    chrome.tabs.sendMessage(
      tabId,
      {
        type: VIDEO_CONTEXT_REQUEST_TYPE,
        payload: { requestId }
      },
      () => {
        if (chrome.runtime.lastError) {
          clearTimeout(responseTimeout);
          chrome.runtime.onMessage.removeListener(handleResponseMessage);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Begin a download for the provided video context data.
 * @param {VideoContextPayload} videoContextPayload - The details about the video.
 * @returns {void}
 */
function startDownloadFromContext(videoContextPayload) {
  if (!videoContextPayload.videoUrl) {
    reportDownloadError("ReelDL could not find a downloadable video URL.");
    return;
  }

  const filenameToUse = buildDownloadFilename(videoContextPayload);

  chrome.downloads.download(
    {
      url: videoContextPayload.videoUrl,
      filename: filenameToUse,
      saveAs: true
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        reportDownloadError(
          "ReelDL could not start the download. The URL may be blocked."
        );
      }
    }
  );
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

  const videoContextPayload = await requestVideoContextFromTab(
    tabInformation.id
  );

  if (!videoContextPayload) {
    reportDownloadError(
      "ReelDL could not reach the content script. The page might be blocked."
    );
    return;
  }

  startDownloadFromContext(videoContextPayload);
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
