// 1. Weekly Grid Math Helpers
export function getWorkDaysOfWeek(referenceDate = new Date()) {
  const days = [];
  const temp = new Date(referenceDate);
  // Get to Monday of the week
  const day = temp.getDay();
  const diff = temp.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(temp.setDate(diff));

  for (let i = 0; i < 5; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    nextDay.setHours(0, 0, 0, 0);
    days.push(nextDay);
  }
  return days;
}

// 2. Generate standard Mock Meetings for testing
export function generateMockMeetings(referenceDate = new Date()) {
  const days = getWorkDaysOfWeek(referenceDate);
  
  const meetings = [
    // Mon: Sprint planning
    {
      id: "mock-meet-1",
      title: "Sprint Planning Sync",
      start: new Date(new Date(days[0]).setHours(10, 0, 0, 0)),
      end: new Date(new Date(days[0]).setHours(11, 30, 0, 0)),
      isMeeting: true,
    },
    // Daily lunch blocks (12:00 PM - 1:00 PM)
    ...days.map((day, idx) => ({
      id: `mock-lunch-${idx}`,
      title: "🍱 Lunch Break",
      start: new Date(new Date(day).setHours(12, 0, 0, 0)),
      end: new Date(new Date(day).setHours(13, 0, 0, 0)),
      isMeeting: true,
    })),
    // Wed: Design Sync
    {
      id: "mock-meet-3",
      title: "Design System Review",
      start: new Date(new Date(days[2]).setHours(14, 0, 0, 0)),
      end: new Date(new Date(days[2]).setHours(15, 30, 0, 0)),
      isMeeting: true,
    },
    // Thu: Company weekly sync
    {
      id: "mock-meet-4",
      title: "Company Weekly Sync",
      start: new Date(new Date(days[3]).setHours(13, 30, 0, 0)),
      end: new Date(new Date(days[3]).setHours(14, 30, 0, 0)),
      isMeeting: true,
    },
  ];

  return meetings;
}

// 3. AI Scheduling Engine: Schedule subtasks into free slots
export function autoScheduleSubtasks(tasks, meetings, referenceDate = new Date()) {
  const workDays = getWorkDaysOfWeek(referenceDate);
  const scheduledBlocks = [...meetings]; // Start with existing meetings

  // Get active (uncompleted) subtasks and sort parent tasks by urgency:
  // Earliest deadline first, then highest priority
  const activeTasks = [...tasks]
    .filter(t => t.status !== "completed")
    .sort((a, b) => {
      const deadlineA = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline || 0);
      const deadlineB = b.deadline?.toDate ? b.deadline.toDate() : new Date(b.deadline || 0);
      
      if (deadlineA - deadlineB !== 0) return deadlineA - deadlineB;
      
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

  // Flat list of subtasks needing scheduling
  const subtasksToSchedule = [];
  activeTasks.forEach((task) => {
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach((sub, idx) => {
        if (!sub.completed) {
          if (sub.scheduledStart && sub.scheduledEnd) {
            const start = sub.scheduledStart.toDate ? sub.scheduledStart.toDate() : new Date(sub.scheduledStart);
            const end = sub.scheduledEnd.toDate ? sub.scheduledEnd.toDate() : new Date(sub.scheduledEnd);
            scheduledBlocks.push({
              id: `${task.id}-sub-${idx}`,
              title: `${task.title}: ${sub.title}`,
              start: start,
              end: end,
              isMeeting: false,
              priority: task.priority,
              isAIOptimized: true
            });
          } else {
            subtasksToSchedule.push({
              taskId: task.id,
              parentTitle: task.title,
              priority: task.priority || "medium",
              subtaskTitle: sub.title,
              durationHours: sub.durationHours || 1,
              subtaskIdx: idx,
            });
          }
        }
      });
    }
  });

  // Time Slot Allocation Algorithm:
  // Iterate through each hour block in the work week and attempt to place subtasks.
  // Working Hours: 9:00 AM to 5:00 PM (Mon-Fri)
  const timeIncrementMinutes = 30; // 30-minute slot slices for granular scheduling
  
  // Allocate each subtask sequential slot
  subtasksToSchedule.forEach((sub) => {
    let subtaskDurationMs = sub.durationHours * 60 * 60 * 1000;
    let scheduled = false;

    // Search for a suitable slot day-by-day
    for (let d = 0; d < workDays.length && !scheduled; d++) {
      const day = workDays[d];
      
      // Determine daily hour ranges: 9 AM to 5 PM
      let hourPointer = 9; // Start at 9:00 AM
      let minutePointer = 0;

      while (hourPointer < 17 && !scheduled) {
        const slotStart = new Date(day);
        slotStart.setHours(hourPointer, minutePointer, 0, 0);

        const slotEnd = new Date(slotStart.getTime() + subtaskDurationMs);
        
        // Ensure slot fits within working hours of that day (ends by 5:00 PM)
        const maxWorkEnd = new Date(day);
        maxWorkEnd.setHours(17, 0, 0, 0);

        if (slotEnd <= maxWorkEnd) {
          // Check if this slot overlaps with ANY already scheduled block (meetings or other subtasks)
          const overlaps = scheduledBlocks.some((block) => {
            const blockStart = new Date(block.start);
            const blockEnd = new Date(block.end);
            return slotStart < blockEnd && slotEnd > blockStart;
          });

          // Focus matching constraint:
          // High-priority subtasks prefer Peak Focus Hours (9 AM - 11 AM)
          const isPeakHour = slotStart.getHours() >= 9 && slotStart.getHours() < 11;
          const priorityMatch = sub.priority !== "high" || isPeakHour;

          if (!overlaps && priorityMatch) {
            // Allocate slot!
            scheduledBlocks.push({
              id: `${sub.taskId}-sub-${sub.subtaskIdx}`,
              title: `${sub.parentTitle}: ${sub.subtaskTitle}`,
              start: slotStart,
              end: slotEnd,
              isMeeting: false,
              priority: sub.priority,
            });
            scheduled = true;
          }
        }

        // Advance slot pointer
        minutePointer += timeIncrementMinutes;
        if (minutePointer >= 60) {
          minutePointer = 0;
          hourPointer += 1;
        }
      }
    }

    // Fallback search: If a High priority subtask couldn't fit in Peak Hours,
    // search any open slot in the week.
    if (!scheduled && sub.priority === "high") {
      for (let d = 0; d < workDays.length && !scheduled; d++) {
        const day = workDays[d];
        let hourPointer = 9;
        let minutePointer = 0;

        while (hourPointer < 17 && !scheduled) {
          const slotStart = new Date(day);
          slotStart.setHours(hourPointer, minutePointer, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + subtaskDurationMs);
          const maxWorkEnd = new Date(day);
          maxWorkEnd.setHours(17, 0, 0, 0);

          if (slotEnd <= maxWorkEnd) {
            const overlaps = scheduledBlocks.some((block) => {
              const blockStart = new Date(block.start);
              const blockEnd = new Date(block.end);
              return slotStart < blockEnd && slotEnd > blockStart;
            });

            if (!overlaps) {
              scheduledBlocks.push({
                id: `${sub.taskId}-sub-${sub.subtaskIdx}`,
                title: `${sub.parentTitle}: ${sub.subtaskTitle}`,
                start: slotStart,
                end: slotEnd,
                isMeeting: false,
                priority: sub.priority,
              });
              scheduled = true;
            }
          }

          minutePointer += timeIncrementMinutes;
          if (minutePointer >= 60) {
            minutePointer = 0;
            hourPointer += 1;
          }
        }
      }
    }
  });

  return scheduledBlocks;
}

// 4. Fetch Google Calendar Events (OAuth flow wrapper)
export async function fetchGoogleCalendarEvents(accessToken, timeMin, timeMax) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Calendar: HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.items || []).map((item) => ({
    id: item.id,
    title: item.summary || "(No Title)",
    start: new Date(item.start.dateTime || item.start.date),
    end: new Date(item.end.dateTime || item.end.date),
    isMeeting: true,
  }));
}
