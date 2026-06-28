// Create right-click context menu item on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-deadlineiq",
    title: "Save to DeadlineIQ: \"%s\"",
    contexts: ["selection"]
  });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-deadlineiq" && info.selectionText) {
    const selectedText = info.selectionText;
    
    // Save to local queue
    const newTask = {
      title: selectedText.substring(0, 50) + (selectedText.length > 50 ? "..." : ""),
      priority: "medium",
      status: "today",
      createdAt: new Date().toISOString()
    };

    chrome.storage.local.get({ queuedTasks: [] }, (result) => {
      const list = result.queuedTasks;
      list.push(newTask);
      chrome.storage.local.set({ queuedTasks: list }, () => {
        // Trigger alert notification
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png", // Will default fallback if missing
          title: "Saved to DeadlineIQ 🧠",
          message: `Added: "${newTask.title}" directly from webpage selection.`,
          priority: 2
        });
      });
    });
  }
});

// Listener for message communications from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NOTIFY_NEW_TASK") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Task Inbox Synced",
      message: `"${message.taskTitle}" added to your anti-procrastination queue.`,
      priority: 2
    });
  } else if (message.type === "START_FOCUS_MODE") {
    // Open DeadlineIQ Dashboard in a new tab
    chrome.tabs.create({ url: "http://localhost:5173/dashboard" });
    
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Focus Block Initiated ⏱️",
      message: "Tunnel Vision focus session launched. Lock in!",
      priority: 2
    });
  }
});
