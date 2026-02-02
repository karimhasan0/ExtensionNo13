chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "IMPORT_PRODUCT") {
    fetch("https://dropbridge.onrender.com/import-from-extension", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message.payload),
    })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Background fetch failed:", error);
        sendResponse({ success: false, error });
      });

    return true; // REQUIRED for async response
  }
});
