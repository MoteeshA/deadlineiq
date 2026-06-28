import { getWorkDaysOfWeek } from "../utils/scheduler";

export default function WeeklyCalendarGrid({ referenceDate = new Date(), events = [] }) {
  const workDays = getWorkDaysOfWeek(referenceDate);
  const hours = [9, 10, 11, 12, 13, 14, 15, 16]; // 9 AM to 4 PM start hours

  const formatTimeStr = (dateObj) => {
    return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const getEventPosition = (event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    // Calculate minutes since 9:00 AM
    const startHour = start.getHours();
    const startMin = start.getMinutes();

    const startMinutesSince9 = (startHour - 9) * 60 + startMin;
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    // Clamp values within working hours (9 AM - 5 PM = 480 mins)
    const topPercent = Math.max(0, Math.min(100, (startMinutesSince9 / 480) * 100));
    const heightPercent = Math.max(5, Math.min(100 - topPercent, (durationMinutes / 480) * 100));

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
    };
  };

  const isSameDay = (d1, d2) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 overflow-x-auto min-w-[700px]">
      {/* Grid Headers */}
      <div className="grid grid-cols-12 gap-2 mb-4 border-b border-slate-800/60 pb-3 text-center items-center">
        {/* Hour column empty placeholder */}
        <div className="col-span-1 text-xs font-bold text-slate-500 uppercase tracking-widest text-left pl-2">
          Time
        </div>
        {/* Day columns */}
        {workDays.map((day, idx) => {
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div key={idx} className="col-span-2 flex flex-col items-center">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isToday ? "text-indigo-400" : "text-slate-500"}`}>
                {day.toLocaleDateString([], { weekday: "short" })}
              </span>
              <span className={`text-base font-black mt-0.5 ${isToday ? "text-indigo-300" : "text-slate-200"}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
        {/* End padding spacing column */}
        <div className="col-span-1" />
      </div>

      {/* Grid Content Area */}
      <div className="relative flex flex-row flex-1 min-h-[480px]">
        {/* Hour Timeline Labels Sidebar */}
        <div className="w-[8.333333%] flex flex-col justify-between text-[10px] font-bold text-slate-500 pr-3 pb-2 border-r border-slate-800/40 select-none">
          {hours.map((hr) => (
            <div key={hr} className="h-12 flex items-start pt-1">
              {hr > 12 ? hr - 12 : hr}:00 {hr >= 12 ? "PM" : "AM"}
            </div>
          ))}
          <div className="h-0 flex items-start -translate-y-2">5:00 PM</div>
        </div>

        {/* Calendar Days Columns (5 columns total) */}
        <div className="grid grid-cols-10 flex-1 relative ml-2">
          {/* Background Grid Lines helper */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {hours.map((hr) => (
              <div key={hr} className="border-b border-slate-850/50 w-full h-[60px]" />
            ))}
            <div className="h-0 w-full" />
          </div>

          {/* Render Columns */}
          {workDays.map((day, dayIdx) => {
            const isThursday = day.getDay() === 4; // Thursday is Danger Zone
            const dayEvents = events.filter((e) => isSameDay(new Date(e.start), day));

            return (
              <div
                key={dayIdx}
                className="col-span-2 border-r border-slate-850/50 last:border-0 relative h-full group"
              >
                {/* 1. Peak Focus Window Visual Highlight (9 AM - 11 AM) */}
                <div 
                  className="absolute left-1 right-1 border border-dashed border-emerald-500/35 bg-emerald-500/5 rounded-xl pointer-events-none flex flex-col justify-start p-1.5 transition-all group-hover:bg-emerald-500/8"
                  style={{ top: "0%", height: "25%" }}
                >
                  <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    🟢 Peak Window
                  </span>
                </div>

                {/* 2. Danger Zone Visual Highlight (Thursday 2 PM - 5 PM) */}
                {isThursday && (
                  <div
                    className="absolute left-1 right-1 border border-dashed border-amber-500/35 bg-amber-500/5 rounded-xl pointer-events-none flex flex-col justify-start p-1.5 transition-all group-hover:bg-amber-500/8"
                    style={{ top: "62.5%", height: "37.5%" }}
                  >
                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                      🔴 Danger Zone
                    </span>
                  </div>
                )}

                {/* 3. Render Events */}
                {dayEvents.map((evt) => {
                  const { top, height } = getEventPosition(evt);
                  const isMeeting = evt.isMeeting;

                  return (
                    <div
                      key={evt.id}
                      style={{ top, height }}
                      className={`absolute left-1.5 right-1.5 rounded-xl p-2 flex flex-col justify-between border select-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                        isMeeting
                          ? "bg-blue-600/10 border-blue-500/30 border-l-4 border-l-blue-500 hover:bg-blue-600/15"
                          : "bg-indigo-600/10 border-indigo-500/30 border-l-4 border-l-indigo-500 hover:bg-indigo-600/15"
                      }`}
                      title={`${evt.title}\n${formatTimeStr(evt.start)} - ${formatTimeStr(evt.end)}`}
                    >
                      <div className="overflow-hidden flex flex-col h-full justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[7px] font-extrabold uppercase tracking-widest text-slate-400 shrink-0">
                              {isMeeting ? "Sync" : "Subtask"}
                            </span>
                            {!isMeeting && evt.priority && (
                              <span className={`text-[7px] font-extrabold px-1 rounded uppercase ${
                                evt.priority === "high" ? "bg-rose-500/20 text-rose-300" :
                                evt.priority === "medium" ? "bg-amber-500/20 text-amber-300" :
                                "bg-emerald-500/20 text-emerald-300"
                              }`}>
                                {evt.priority}
                              </span>
                            )}
                          </div>
                          <h5 className="text-[10px] font-bold text-slate-100 leading-tight mt-0.5 truncate group-hover:text-white">
                            {evt.title}
                          </h5>
                        </div>
                        <span className="text-[8px] font-semibold text-slate-400/90 tracking-wide mt-1 shrink-0">
                          {formatTimeStr(evt.start)} - {formatTimeStr(evt.end)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
