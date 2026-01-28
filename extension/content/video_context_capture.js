"use strict";

/**
 * @typedef {Object} ContextMenuTargetData
 * @property {string} pageUrl - The URL of the page where the user right-clicked.
 * @property {string} elementTagName - The tag name of the element that was clicked.
 * @property {string | null} elementAriaLabel - The accessible label, if present.
 */

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
  chrome.storage.local.set({
    lastContextMenuTarget: contextMenuTargetData
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
}

// Beginner-friendly note: the "contextmenu" event fires on right-click.
window.addEventListener("contextmenu", handleContextMenuEvent);
