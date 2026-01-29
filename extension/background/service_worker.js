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
 * @property {string} pageUrl - The canonical page URL for the current page.
 * @property {string} pageTitle - The document title to help identify the content.
 * @property {string} platformName - The platform or site name derived from metadata.
 * @property {string} requestId - The identifier for the request-response cycle.
 * @property {VideoDebugDetails} debugDetails - Extra details to help with debugging.
 */

/**
 * @typedef {Object} VideoDebugDetails
 * @property {string} pageUrl - The URL of the page where the request originated.
 * @property {ContextMenuTargetData | null} lastContextMenuTarget - The last stored context menu data.
 * @property {VideoMetadataDebugDetails} metadata - Debug details from page metadata.
 */

/**
 * @typedef {Object} ContextMenuTargetData
 * @property {string} pageUrl - The URL of the page where the user right-clicked.
 * @property {string} elementTagName - The tag name of the element that was clicked.
 * @property {string | null} elementAriaLabel - The accessible label, if present.
 */

/**
 * @typedef {Object} VideoMetadataDebugDetails
 * @property {string | null} openGraphUrl - The og:url metadata if present.
 * @property {string | null} openGraphSiteName - The og:site_name metadata if present.
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
 * The maximum time (in milliseconds) to wait for a content script response.
 * @type {number}
 */
const RESPONSE_TIMEOUT_IN_MILLISECONDS = 3000;

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
 * Request video context data from the active tab's content script.
 * @param {number} tabId - The identifier of the active tab.
 * @returns {Promise<VideoContextPayload | null>}
 */
function requestVideoContextFromTab(tabId) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve) => {
    const responseTimeout = setTimeout(() => {
      logDebugInformation("Timed out waiting for content script response.", {
        tabId,
        requestId
      });
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
        logDebugInformation("Received video context response.", message.payload);
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
          logDebugInformation("Failed to message the content script.", {
            tabId,
            requestId,
            errorMessage: chrome.runtime.lastError.message
          });
          clearTimeout(responseTimeout);
          chrome.runtime.onMessage.removeListener(handleResponseMessage);
          resolve(null);
        }
      }
    );
  });
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

  const videoContextPayload = await requestVideoContextFromTab(
    tabInformation.id
  );

  if (!videoContextPayload) {
    reportDownloadError(
      "ReelDL could not reach the content script. The page might be blocked."
    );
    return;
  }

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
