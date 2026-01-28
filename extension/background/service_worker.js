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
 * The unique identifier for the context menu entry that this extension creates.
 * @type {string}
 */
const CONTEXT_MENU_IDENTIFIER = "reeldl_save_page_url";

/**
 * Create a single context menu entry that is visible on every page.
 * @returns {void}
 */
function createContextMenuEntry() {
  // Beginner-friendly note: removeAll prevents duplicate menu entries on reload.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDENTIFIER,
      title: "Save current page URL",
      contexts: ["page"]
    });
  });
}

/**
 * Save the current page URL from the context menu click into extension storage.
 * @param {ContextMenuClickInfo} clickInformation - Details about the context menu click.
 * @param {TabInformation} tabInformation - The tab where the click occurred.
 * @returns {void}
 */
function handleContextMenuClick(clickInformation, tabInformation) {
  if (clickInformation.menuItemId !== CONTEXT_MENU_IDENTIFIER) {
    return;
  }

  const pageUrlToStore = clickInformation.pageUrl ?? tabInformation.url;

  // Beginner-friendly note: chrome.storage.local keeps data on the user's machine.
  chrome.storage.local.set({
    lastSavedPageUrl: pageUrlToStore
  });
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
