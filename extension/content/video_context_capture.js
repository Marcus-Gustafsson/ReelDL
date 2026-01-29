"use strict";

/**
 * @typedef {Object} ContextMenuTargetData
 * @property {string} pageUrl - The URL of the page where the user right-clicked.
 * @property {string} elementTagName - The tag name of the element that was clicked.
 * @property {string | null} elementAriaLabel - The accessible label, if present.
 */

/**
 * @typedef {Object} VideoContextResponse
 * @property {string | null} videoUrl - The extracted video URL, when available.
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
 * Track the last element the user right-clicked so we can search nearby later.
 * @type {Element | null}
 */
let lastRightClickedElement = null;

/**
 * @typedef {Object} VideoDebugDetails
 * @property {string} pageUrl - The URL of the page where the request originated.
 * @property {ContextMenuTargetData | null} lastContextMenuTarget - The last stored context menu data.
 * @property {VideoElementDebugDetails | null} nearestVideoElement - Debug details about the closest video element.
 * @property {VideoMetadataDebugDetails} metadata - Debug details from page metadata.
 */

/**
 * @typedef {Object} VideoElementDebugDetails
 * @property {string | null} tagName - The element tag name if present.
 * @property {string | null} currentSourceUrl - The currentSrc value when available.
 * @property {string | null} sourceUrl - The src attribute value when available.
 * @property {string[]} nestedSourceUrls - Any <source> URLs inside the video element.
 * @property {boolean} hasBlobUrl - Whether any candidate URLs use a blob scheme.
 * @property {boolean} isVideoPaused - Whether the video element is paused.
 * @property {boolean} isVideoEnded - Whether the video element is ended.
 */

/**
 * @typedef {Object} VideoMetadataDebugDetails
 * @property {string | null} openGraphVideo - The og:video metadata if present.
 * @property {string | null} openGraphVideoUrl - The og:video:url metadata if present.
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
 * Remember the last element that was right-clicked.
 * @param {MouseEvent} mouseEvent - The context menu event from the page.
 * @returns {void}
 */
function storeLastRightClickedElement(mouseEvent) {
  // Beginner-friendly note: we keep this in memory for quick access.
  lastRightClickedElement =
    mouseEvent.target instanceof Element ? mouseEvent.target : null;
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
 * Find the nearest video element by walking up the DOM from a starting element.
 * @param {Element | null} startingElement - The element the user right-clicked.
 * @returns {HTMLVideoElement | null}
 */
function findNearestVideoElement(startingElement) {
  let currentElement = startingElement;

  while (currentElement) {
    // Beginner-friendly note: if the current element IS a video, return it.
    if (currentElement instanceof HTMLVideoElement) {
      return currentElement;
    }

    // Beginner-friendly note: if a container holds a video, use the first one.
    const nestedVideoElement = currentElement.querySelector("video");
    if (nestedVideoElement instanceof HTMLVideoElement) {
      return nestedVideoElement;
    }

    currentElement = currentElement.parentElement;
  }

  // As a fallback, return the first video on the page if we didn't find nearby.
  const firstVideoElement = document.querySelector("video");
  return firstVideoElement instanceof HTMLVideoElement ? firstVideoElement : null;
}

/**
 * Extract a usable video URL from a video element.
 * @param {HTMLVideoElement | null} videoElement - The video element to inspect.
 * @returns {string | null}
 */
function extractVideoUrlFromElement(videoElement) {
  if (!videoElement) {
    return null;
  }

  // Beginner-friendly note: currentSrc is the most reliable once playback starts.
  if (videoElement.currentSrc) {
    return videoElement.currentSrc;
  }

  if (videoElement.src) {
    return videoElement.src;
  }

  const sourceElement = videoElement.querySelector("source");
  if (sourceElement instanceof HTMLSourceElement && sourceElement.src) {
    return sourceElement.src;
  }

  return null;
}

/**
 * Collect debug details from a video element for troubleshooting.
 * @param {HTMLVideoElement | null} videoElement - The video element to inspect.
 * @returns {VideoElementDebugDetails | null}
 */
function buildVideoElementDebugDetails(videoElement) {
  if (!videoElement) {
    return null;
  }

  const nestedSourceUrls = Array.from(
    videoElement.querySelectorAll("source")
  ).map((sourceElement) => sourceElement.src).filter(Boolean);

  const candidateUrls = [
    videoElement.currentSrc,
    videoElement.src,
    ...nestedSourceUrls
  ].filter(Boolean);

  const hasBlobUrl = candidateUrls.some((urlCandidate) =>
    urlCandidate.startsWith("blob:")
  );

  return {
    tagName: videoElement.tagName,
    currentSourceUrl: videoElement.currentSrc || null,
    sourceUrl: videoElement.src || null,
    nestedSourceUrls,
    hasBlobUrl,
    isVideoPaused: videoElement.paused,
    isVideoEnded: videoElement.ended
  };
}

/**
 * Extract a video URL from page metadata like Open Graph tags.
 * @returns {string | null}
 */
function extractVideoUrlFromMetadata() {
  const openGraphVideo =
    document.querySelector('meta[property="og:video"]') ||
    document.querySelector('meta[property="og:video:url"]');

  if (openGraphVideo instanceof HTMLMetaElement && openGraphVideo.content) {
    return openGraphVideo.content;
  }

  return null;
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
 * Build the payload sent back to the background service worker.
 * @param {string} requestId - The identifier for the request-response cycle.
 * @returns {VideoContextResponse}
 */
function buildVideoContextResponse(requestId) {
  const nearestVideoElement = findNearestVideoElement(lastRightClickedElement);
  const videoUrlFromElement = extractVideoUrlFromElement(nearestVideoElement);
  const videoUrlFromMetadata = extractVideoUrlFromMetadata();
  const pageUrl = extractPageUrlFromMetadata();

  return {
    videoUrl: videoUrlFromElement ?? videoUrlFromMetadata,
    pageUrl,
    pageTitle: document.title,
    platformName: getPlatformName(),
    requestId,
    debugDetails: {
      pageUrl: window.location.href,
      lastContextMenuTarget: lastContextMenuTargetData,
      nearestVideoElement: videoElementDebugDetails,
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
  storeLastRightClickedElement(mouseEvent);
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
