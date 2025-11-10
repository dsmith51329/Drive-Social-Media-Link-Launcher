chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openTabs" && request.urls.length > 0) {
    let openedTabs = [];

    request.urls.forEach(url => {
      chrome.tabs.create({ url: url, active: false }, (tab) => {
        if (tab) {
          openedTabs.push(tab.id);
          chrome.storage.session.set({ "openedLinks": openedTabs });
        }
      });
    });

    console.log("[DEBUG] Opened tabs:", openedTabs);
    sendResponse({ success: true });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  chrome.storage.session.get("openedLinks", (data) => {
    let openedTabs = data.openedLinks || [];
    
    if (openedTabs.length > 0) {
      console.log("[DEBUG] Closing previously opened tabs:", openedTabs);
      chrome.tabs.remove(openedTabs, () => {
        console.log("[DEBUG] Tabs closed successfully.");
      });
      chrome.storage.session.remove("openedLinks");
    } else {
      try {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
      } catch (error) {
        console.error("Failed to execute script:", error.message);
      }
    }
  });
});