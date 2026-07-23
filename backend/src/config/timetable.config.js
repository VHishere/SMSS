const WEEK_DAYS = [
  {
    value: 2,
    label: "Thứ 2",
    shortLabel: "T2",
  },
  {
    value: 3,
    label: "Thứ 3",
    shortLabel: "T3",
  },
  {
    value: 4,
    label: "Thứ 4",
    shortLabel: "T4",
  },
  {
    value: 5,
    label: "Thứ 5",
    shortLabel: "T5",
  },
  {
    value: 6,
    label: "Thứ 6",
    shortLabel: "T6",
  },
  {
    value: 7,
    label: "Thứ 7",
    shortLabel: "T7",
  },
];

const TIMETABLE_SLOTS = [
  {
    periodNo: 1,
    session: "MORNING",
    sessionLabel: "Buổi sáng",
    startTime: "07:30",
    endTime: "08:15",
    breakAfterMinutes: 5,
  },
  {
    periodNo: 2,
    session: "MORNING",
    sessionLabel: "Buổi sáng",
    startTime: "08:20",
    endTime: "09:05",
    breakAfterMinutes: 5,
  },
  {
    periodNo: 3,
    session: "MORNING",
    sessionLabel: "Buổi sáng",
    startTime: "09:10",
    endTime: "09:55",
    breakAfterMinutes: 5,
  },
  {
    periodNo: 4,
    session: "MORNING",
    sessionLabel: "Buổi sáng",
    startTime: "10:00",
    endTime: "10:45",
    breakAfterMinutes: null,
  },

  {
    periodNo: 5,
    session: "AFTERNOON",
    sessionLabel: "Buổi chiều",
    startTime: "13:30",
    endTime: "14:15",
    breakAfterMinutes: 5,
  },
  {
    periodNo: 6,
    session: "AFTERNOON",
    sessionLabel: "Buổi chiều",
    startTime: "14:20",
    endTime: "15:05",
    breakAfterMinutes: 5,
  },
  {
    periodNo: 7,
    session: "AFTERNOON",
    sessionLabel: "Buổi chiều",
    startTime: "15:10",
    endTime: "15:55",
    breakAfterMinutes: 5,
  },
  {
    periodNo: 8,
    session: "AFTERNOON",
    sessionLabel: "Buổi chiều",
    startTime: "16:00",
    endTime: "16:45",
    breakAfterMinutes: null,
  },
];

module.exports = {
  WEEK_DAYS,
  TIMETABLE_SLOTS,
};