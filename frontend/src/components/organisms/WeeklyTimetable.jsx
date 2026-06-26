import { useMemo } from "react";

import TimetableLessonCard from "../molecules/TimetableLessonCard";

function buildLessonKey(dayOfWeek, periodNo) {
  return `${dayOfWeek}-${periodNo}`;
}

function getPeriodTheme(periodNo) {
  const themes = {
    1: "bg-orange-50 text-[#F27123]",
    2: "bg-green-50 text-green-700",
    3: "bg-blue-50 text-[#08509F]",
    4: "bg-cyan-50 text-cyan-700",
    5: "bg-purple-50 text-purple-700",
    6: "bg-amber-50 text-amber-700",
    7: "bg-pink-50 text-pink-700",
    8: "bg-slate-100 text-slate-700",
  };

  return themes[periodNo] || themes[1];
}

function getRowClass(slot) {
  if (slot.periodNo === 5) {
    return "bg-blue-50/30 border-t-4 border-t-blue-100";
  }

  if (slot.session === "MORNING") {
    return "bg-[#FFF7F2]/45";
  }

  return "bg-blue-50/30";
}

function WeeklyTimetable({
  weekDays = [],
  slots = [],
  lessons = [],
}) {
  const lessonMap = useMemo(() => {
    return new Map(
      lessons.map((lesson) => [
        buildLessonKey(
          lesson.dayOfWeek,
          lesson.periodNo,
        ),
        lesson,
      ]),
    );
  }, [lessons]);

  return (
    <section
      className="
        overflow-hidden rounded-3xl
        border border-orange-100
        bg-white shadow-sm
      "
    >
      <div className="overflow-x-auto p-4">
        <table
          className="
            table-fixed
            w-full min-w-[1280px]
            border-separate border-spacing-0
            overflow-hidden rounded-2xl
            border border-slate-200
          "
        >
          <colgroup>
            <col className="w-24" />
            <col className="w-40" />

            {weekDays.map((day) => (
              <col
                key={day.value}
                className="w-[180px]"
              />
            ))}
          </colgroup>

          <thead>
            <tr className="bg-[#0F2747] text-white">
              <th
                className="
                  sticky left-0 z-30
                  border-r border-white/10
                  bg-[#0F2747]
                  px-4 py-4 text-center
                  text-sm font-bold
                "
              >
                Tiết
              </th>

              <th
                className="
                  sticky left-24 z-30
                  border-r border-white/10
                  bg-[#0F2747]
                  px-4 py-4 text-left
                  text-sm font-bold
                "
              >
                Thời gian
              </th>

              {weekDays.map((day) => (
                <th
                  key={day.value}
                  className="
                    border-r border-white/10
                    px-4 py-4 text-center
                    text-sm font-bold last:border-r-0
                  "
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {slots.map((slot) => {
              const rowClass = getRowClass(slot);

              return (
                <tr
                  key={slot.periodNo}
                  className={rowClass}
                >
                  <th
                    className="
                      sticky left-0 z-20
                      border-r border-b border-slate-200
                      bg-white px-4 py-3
                      text-center align-middle
                    "
                  >
                    <span
                      className={`
                        inline-flex h-9 w-9
                        items-center justify-center
                        rounded-full text-sm font-bold
                        ${getPeriodTheme(slot.periodNo)}
                      `}
                    >
                      {slot.periodNo}
                    </span>
                  </th>

                  <th
                    className="
                      sticky left-24 z-20
                      border-r border-b border-slate-200
                      bg-white px-4 py-3
                      text-left align-middle
                    "
                  >
                    <p className="mb-0 text-sm font-semibold text-[#0F2747]">
                      {slot.startTime}
                      {" – "}
                      {slot.endTime}
                    </p>
                  </th>

                  {weekDays.map((day) => {
                    const lesson = lessonMap.get(
                      buildLessonKey(
                        day.value,
                        slot.periodNo,
                      ),
                    );

                    return (
                      <td
                        key={`${day.value}-${slot.periodNo}`}
                        className="
                          border-r border-b border-slate-200
                          bg-white/60 px-2 py-2
                          align-top last:border-r-0
                        "
                      >
                        <TimetableLessonCard
                          lesson={lesson}
                          periodNo={slot.periodNo}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default WeeklyTimetable;