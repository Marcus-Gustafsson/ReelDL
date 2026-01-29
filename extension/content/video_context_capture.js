"use strict";

/**
 * @typedef {Object} ContextMenuTargetData
 * @property {string} pageUrl - The URL of the page where the user right-clicked.
 * @property {string} elementTagName - The tag name of the element that was clicked.
 * @property {string | null} elementAriaLabel - The accessible label, if present.
 */

/**
 * @typedef {Object} VideoContextResponse
 * @property {string} pageUrl - The canonical page URL for the current page.
 * @property {string} pageTitle - The document title to help identify the content.
 * @property {string} platformName - The platform or site name derived from metadata.
 * @property {string} requestId - The identifier for the request-response cycle.
 * @property {VideoDebugDetails} debugDetails - Extra details to help with debugging.
 */

/**
 * @typedef {Object} VideoContextRequest
 * @property {string} requestId - The identifier for the request-response cycle.
 */

/**
 * @typedef {Object} VideoDebugDetails
 * @property {string} pageUrl - The URL of the page where the request originated.
 * @property {ContextMenuTargetData | null} lastContextMenuTarget - The last stored context menu data.
 * @property {VideoMetadataDebugDetails} metadata - Debug details from page metadata.
 */

/**
 * @typedef {Object} VideoMetadataDebugDetails
 * @property {string | null} openGraphUrl - The og:url metadata if present.
 * @property {string | null} openGraphSiteName - The og:site_name metadata if present.
 */

/**
 * Track the last context menu target details for debugging.
 * @type {ContextMenuTargetData | null}
 */
let lastContextMenuTargetData = null;

/**
 * Log debug information in a consistent format for beginners.
 * @param {string} debugMessage - The message to display.
 * @param {unknown} debugPayload - Extra data that helps troubleshooting.
 * @returns {void}
 */
function logDebugInformation(debugMessage, debugPayload) {
  console.info(`[ReelDL][Content] ${debugMessage}`, debugPayload);
}

/**
 * Extract data about the element the user right-clicked on.
 * @param {MouseEvent} mouseEvent - The context menu mouse event from the page.
 * @returns {ContextMenuTargetData}
 */
function buildContextMenuTargetData(mouseEvent) {
  const targetElement = mouseEvent.target;

  const elementTagName =
    targetElement instanceof HTMLElement ? targetElement.tagName : "UNKNOWN";
  const elementAriaLabel =
    targetElement instanceof HTMLElement
      ? targetElement.getAttribute("aria-label")
      : null;

  return {
    pageUrl: window.location.href,
    elementTagName,
    elementAriaLabel
  };
}

/**
 * Store the most recent right-click context information for future use.
 * @param {ContextMenuTargetData} contextMenuTargetData - Details about the user interaction.
 * @returns {void}
 */
function storeContextMenuTargetData(contextMenuTargetData) {
  // Beginner-friendly note: chrome.storage.local stores simple JSON-like data.
  lastContextMenuTargetData = contextMenuTargetData;
  chrome.storage.local.set({
    lastContextMenuTarget: contextMenuTargetData
  });
}

/**
 * Extract a canonical page URL from metadata or fall back to the current URL.
 * @returns {string}
 */
function extractPageUrlFromMetadata() {
  // Beginner-friendly note: Open Graph tags often contain the "official" URL.
  const openGraphUrl = document.querySelector('meta[property="og:url"]');

  if (openGraphUrl instanceof HTMLMetaElement && openGraphUrl.content) {
    return openGraphUrl.content;
  }

  // Fallback to the current browser URL if metadata is missing.
  return window.location.href;
}

/**
 * Determine a friendly platform name from metadata or the hostname.
 * @returns {string}
 */
function getPlatformName() {
  const openGraphSiteName = document.querySelector(
    'meta[property="og:site_name"]'
  );

  if (
    openGraphSiteName instanceof HTMLMetaElement &&
    openGraphSiteName.content
  ) {
    return openGraphSiteName.content;
  }

  // Beginner-friendly fallback: use the hostname if no metadata is present.
  return window.location.hostname;
}

/**
 * Collect helpful metadata details for debugging.
 * @returns {VideoMetadataDebugDetails}
 */
function buildMetadataDebugDetails() {
  const openGraphUrlElement = document.querySelector(
    'meta[property="og:url"]'
  );
  const openGraphSiteNameElement = document.querySelector(
    'meta[property="og:site_name"]'
  );

  return {
    openGraphUrl:
      openGraphUrlElement instanceof HTMLMetaElement
        ? openGraphUrlElement.content || null
        : null,
    openGraphSiteName:
      openGraphSiteNameElement instanceof HTMLMetaElement
        ? openGraphSiteNameElement.content || null
        : null
  };
}

/**
 * Build the payload sent back to the background service worker.
 * @param {string} requestId - The identifier for the request-response cycle.
 * @returns {VideoContextResponse}
 */
function buildVideoContextResponse(requestId) {
  const pageUrl = extractPageUrlFromMetadata();
  const metadataDebugDetails = buildMetadataDebugDetails();

  return {
    pageUrl,
    pageTitle: document.title,
    platformName: getPlatformName(),
    requestId,
    debugDetails: {
      pageUrl: window.location.href,
      lastContextMenuTarget: lastContextMenuTargetData,
      metadata: metadataDebugDetails
    }
  };
}

/**
 * Respond to a background request by sending video context details.
 * @param {VideoContextResponse} videoContextResponse - The details to send.
 * @returns {void}
 */
function sendVideoContextResponse(videoContextResponse) {
  // Beginner-friendly note: chrome.runtime.sendMessage talks to the service worker.
  chrome.runtime.sendMessage({
    type: "VIDEO_CONTEXT_RESPONSE",
    payload: videoContextResponse
  });
}

/**
 * Handle the user's right-click on the page and record useful details.
 * @param {MouseEvent} mouseEvent - The context menu event.
 * @returns {void}
 */
function handleContextMenuEvent(mouseEvent) {
  const contextMenuTargetData = buildContextMenuTargetData(mouseEvent);
  storeContextMenuTargetData(contextMenuTargetData);
  logDebugInformation("Stored context menu target data.", contextMenuTargetData);
}

/**
 * Handle incoming messages from the background service worker.
 * @param {unknown} message - The incoming message payload.
 * @returns {void}
 */
function handleRuntimeMessage(message) {
  if (
    typeof message === "object" &&
    message !== null &&
    message.type === "VIDEO_CONTEXT_REQUEST"
  ) {
    const requestPayload = message.payload;
    const requestId =
      typeof requestPayload?.requestId === "string"
        ? requestPayload.requestId
        : "";
    const videoContextResponse = buildVideoContextResponse(requestId);
    logDebugInformation("Sending video context response.", videoContextResponse);
    sendVideoContextResponse(videoContextResponse);
  }
}

// Beginner-friendly note: the "contextmenu" event fires on right-click.
window.addEventListener("contextmenu", handleContextMenuEvent);

// Beginner-friendly note: listen for background requests to gather video context.
chrome.runtime.onMessage.addListener(handleRuntimeMessage);
