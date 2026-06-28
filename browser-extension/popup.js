// Auto-fill active tab title as default task name
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs && tabs[0]) {
    const activeTab = tabs[0];
    const taskTitleInput = document.getElementById("taskTitle");
    if (taskTitleInput && activeTab.title) {
      // Clean up title (remove trailing site names)
      const cleanTitle = activeTab.title.split(" - ")[0].split(" | ")[0];
      taskTitleInput.value = `Read: ${cleanTitle}`;
    }
  }
});

// Handle submit
document.getElementById("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value;
  const priority = document.getElementById("taskPriority").value;

  // Save to chrome storage
  const newTask = {
    title,
    priority,
    url: "",
    status: "today",
    createdAt: new Date().toISOString()
  };

  chrome.storage.local.get({ queuedTasks: [] }, (result) => {
    const list = result.queuedTasks;
    list.push(newTask);
    chrome.storage.local.set({ queuedTasks: list }, () => {
      // Trigger notification notification via service worker
      chrome.runtime.sendMessage({ type: "NOTIFY_NEW_TASK", taskTitle: title });

      // Show success
      document.getElementById("statusMsg").style.display = "block";
      setTimeout(() => {
        window.close();
      }, 1500);
    });
  });
});

// Start Focus mode button handler
document.getElementById("btnFocus").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START_FOCUS_MODE" });
  window.close();
});
