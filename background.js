(() => {
  const version = "2.0.0";
  const logPrefix = `[DriveSocial v${version}]`;

  const log = {
    info: (message, ...args) => console.log(`${logPrefix} [INFO] ${message}`, ...args),
    debug: (message, ...args) => console.log(`${logPrefix} [DEBUG] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`${logPrefix} [WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`${logPrefix} [ERROR] ${message}`, ...args)
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openTabs" && Array.isArray(request.urls) && request.urls.length > 0) {
      const openedTabs = [];
      log.info(`Launching ${request.urls.length} tab(s).`);
      log.debug("Requested tabs:", request.urls);

      request.urls.forEach((url) => {
        chrome.tabs.create({ url, active: false }, (tab) => {
          if (tab && typeof tab.id === "number") {
            openedTabs.push(tab.id);
            chrome.storage.session.set({ openedLinks: openedTabs });
            log.debug(`Opened tab ${tab.id} for ${url}`);
          } else {
            log.warn(`Unable to track tab for ${url}.`);
          }
        });
      });

      sendResponse({ success: true });
      return true;
    }

    return false;
  });

  chrome.action.onClicked.addListener((tab) => {
    chrome.storage.session.get("openedLinks", (data) => {
      const openedTabs = data.openedLinks || [];

      if (openedTabs.length > 0) {
        log.info(`Closing ${openedTabs.length} previously opened tab(s).`);
        log.debug("Tabs queued for closure:", openedTabs);
        chrome.tabs.remove(openedTabs, () => {
          log.debug("Tabs closed successfully.");
          chrome.storage.session.remove("openedLinks");
        });
      } else if (tab && tab.id !== undefined) {
        log.info(`Triggering extraction on tab ${tab.id}.`);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }).catch((error) => {
          log.error("Failed to execute script:", error.message);
        });
      } else {
        log.warn("No active tab available to execute the content script.");
      }
    });
  });
})();
