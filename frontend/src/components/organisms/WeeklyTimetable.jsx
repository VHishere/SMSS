import { useMemo } from "react";

import TimetableLessonCard from "../molecules/TimetableLessonCard";

function buildLessonKey(dayOfWeek, periodNo) {
  return `${dayOfWeek}-${periodNo}`;
}

function SessionTable({
  title,
  slots,
  weekDays,
  lessonMap,
}) {
  const firstSlot = slots[0];
  const lastSlot = slots[slots.length - 1];

  const timeRange =
    firstSlot && lastSlot
      ? `${firstSlot.startTime} – ${lastSlot.endTime}`
      : "Chưa có khung giờ";

  return (
    <section
      className="
        overflow-hidden rounded-2xl
        border border-orange-100
        bg-white shadow-sm
      "
    >
      <div
        className="
          flex flex-wrap items-center
          justify-between gap-3
          border-b border-orange-100
          px-5 py-4
        "
      >
        <div>
          <h2 className="mb-1 text-lg font-bold text-[#0F2747]">
            {title}
          </h2>

          <p className="mb-0 text-sm text-slate-500">
            {timeRange}
          </p>
        </div>

        <span
          className="
            rounded-full bg-[#FFE7D6]
            px-3 py-1.5 text-xs
            font-bold text-[#C94F00]
          "
        >
          {slots.length} tiết
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="bg-[#0F2747] text-white">
              <th
                className="
                  sticky left-0 z-10
                  w-36 bg-[#0F2747]
                  px-4 py-3 text-left
                  text-sm font-semibold
                "
              >
                Tiết học
              </th>

              {weekDays.map((day) => (
                <th
                  key={day.value}
                  className="
                    min-w-40 px-3 py-3
                    text-center text-sm font-semibold
                  "
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {slots.map((slot) => (
              <tr
                key={slot.periodNo}
                className="
                  border-b border-slate-100
                  last:border-b-0
                "
              >
                <th
                  className="
                    sticky left-0 z-10
                    bg-white px-4 py-4
                    text-left align-top
                  "
                >
                  <div className="rounded-xl bg-[#FFF7F2] p-3">
                    <p className="mb-1 text-sm font-bold text-[#F27123]">
                      Tiết {slot.periodNo}
                    </p>

                    <p className="mb-1 text-xs font-semibold text-[#0F2747]">
                      {slot.startTime} – {slot.endTime}
                    </p>

                    {slot.breakAfterMinutes !== null && (
                      <p className="mb-0 text-[11px] text-slate-500">
                        Nghỉ {slot.breakAfterMinutes} phút
                      </p>
                    )}
                  </div>
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
                      className="px-3 py-3 align-top"
                    >
                      <TimetableLessonCard
                        lesson={lesson}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
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

  const morningSlots = slots.filter(
    (slot) => slot.session === "MORNING",
  );

  const afternoonSlots = slots.filter(
    (slot) => slot.session === "AFTERNOON",
  );

  return (
    <div className="space-y-6">
      <SessionTable
        title="Buổi sáng"
        slots={morningSlots}
        weekDays={weekDays}
        lessonMap={lessonMap}
      />

      <SessionTable
        title="Buổi chiều"
        slots={afternoonSlots}
        weekDays={weekDays}
        lessonMap={lessonMap}
      />
    </div>
  );
}

export default WeeklyTimetable;