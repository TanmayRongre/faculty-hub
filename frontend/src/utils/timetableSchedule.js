export const MORNING_SLOTS = ['10:30–11:30', '11:30–12:30', '12:30–1:30'];

export const AFTERNOON_SLOTS = ['1:50–2:50', '2:50–3:50', '4:00–5:00'];

export const SUBJECT_NAMES = {
  STE: 'Software Testing',
  OSY: 'Operating System',
  ACN: 'Advanced Computer Network',
  ENDS: 'Environmental Studies',
  SPI: 'Scripting Language (Python)',
};

export const SUBJECT_THEMES = {
  STE: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-700/50',
    badgeBg: 'bg-blue-900/60',
    text: 'text-blue-300',
    roomText: 'text-blue-400',
  },
  OSY: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-700/50',
    badgeBg: 'bg-emerald-900/60',
    text: 'text-emerald-300',
    roomText: 'text-emerald-400',
  },
  ACN: {
    bg: 'bg-purple-950/40',
    border: 'border-purple-700/50',
    badgeBg: 'bg-purple-900/60',
    text: 'text-purple-300',
    roomText: 'text-purple-400',
  },
  ENDS: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-700/50',
    badgeBg: 'bg-amber-900/60',
    text: 'text-amber-300',
    roomText: 'text-amber-400',
  },
  SPI: {
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-700/50',
    badgeBg: 'bg-cyan-900/60',
    text: 'text-cyan-300',
    roomText: 'text-cyan-400',
  },
};

export const LEGEND_ITEMS = [
  { code: 'STE', name: 'Software Testing', color: 'text-blue-400' },
  { code: 'OSY', name: 'Operating System', color: 'text-emerald-400' },
  { code: 'ACN', name: 'Advanced Computer Network', color: 'text-purple-400' },
  { code: 'ENDS', name: 'Environmental Studies', color: 'text-amber-400' },
  { code: 'SPI', name: 'Scripting Language (Python)', color: 'text-cyan-400' },
];

export const MORNING_SCHEDULE = [
  {
    day: 'Monday',
    slots: [
      { subject: 'STE', room: '109', startTime: '10:30', endTime: '11:30' },
      { subject: 'OSY', room: '109', startTime: '11:30', endTime: '12:30' },
      { subject: 'ACN', room: '109', startTime: '12:30', endTime: '13:30' },
    ],
  },
  {
    day: 'Tuesday',
    slots: [
      { subject: 'ACN', room: '109', startTime: '10:30', endTime: '11:30' },
      { subject: 'OSY', room: '109', startTime: '11:30', endTime: '12:30' },
      { subject: 'STE', room: '109', startTime: '12:30', endTime: '13:30' },
    ],
  },
  {
    day: 'Wednesday',
    slots: [
      { subject: 'OSY', room: '109', startTime: '10:30', endTime: '11:30' },
      { subject: 'ACN', room: '109', startTime: '11:30', endTime: '12:30' },
      { subject: 'STE', room: '109', startTime: '12:30', endTime: '13:30' },
    ],
  },
  {
    day: 'Thursday',
    slots: [
      { subject: 'OSY', room: '109', startTime: '10:30', endTime: '11:30' },
      { subject: 'STE', room: '109', startTime: '11:30', endTime: '12:30' },
      { subject: 'ENDS', room: '109', startTime: '12:30', endTime: '13:30' },
    ],
  },
  {
    day: 'Friday',
    slots: [
      { subject: 'ACN', room: '109', startTime: '10:30', endTime: '11:30' },
      { subject: 'OSY', room: '109', startTime: '11:30', endTime: '12:30' },
      { isOff: true },
    ],
  },
];

export const AFTERNOON_SCHEDULE = [
  {
    day: 'Monday',
    rows: [
      {
        time: '1:50–2:50',
        startTime: '13:50',
        endTime: '14:50',
        batchA: { subject: 'OSY', room: 'CL5', batch: 'A', startTime: '13:50', endTime: '14:50' },
        batchB: { subject: 'STE', room: 'CL7', batch: 'B', startTime: '13:50', endTime: '14:50' },
        batchC: { subject: 'ENDS', room: '109', batch: 'C', startTime: '13:50', endTime: '14:50' },
      },
      {
        time: '2:50–3:50',
        startTime: '14:50',
        endTime: '15:50',
        batchA: { subject: 'STE', room: 'CL7', batch: 'A', startTime: '14:50', endTime: '15:50' },
        batchB: { subject: 'ACN', room: 'CL5', batch: 'B', startTime: '14:50', endTime: '15:50' },
        batchC: { type: 'library', label: 'Library Time' },
      },
    ],
  },
  {
    day: 'Tuesday',
    rows: [
      {
        time: '1:50–2:50',
        startTime: '13:50',
        endTime: '14:50',
        batchA: { subject: 'ACN', room: 'CL5', batch: 'A', startTime: '13:50', endTime: '14:50' },
        batchB: { type: 'library', label: 'Library Time' },
        batchC: { subject: 'STE', room: 'CL6', batch: 'C', startTime: '13:50', endTime: '14:50' },
      },
      {
        time: '4:00–5:00',
        startTime: '16:00',
        endTime: '17:00',
        isCommon: true,
        type: 'sports',
        label: 'Cocurricular Activities / Sports Time',
      },
    ],
  },
  {
    day: 'Wednesday',
    rows: [
      {
        time: '1:50–2:50',
        startTime: '13:50',
        endTime: '14:50',
        batchA: { subject: 'STE', room: 'CL6', batch: 'A', startTime: '13:50', endTime: '14:50' },
        batchB: { subject: 'ENDS', room: '109', batch: 'B', startTime: '13:50', endTime: '14:50' },
        batchC: { subject: 'OSY', room: 'CL5', batch: 'C', startTime: '13:50', endTime: '14:50' },
      },
      {
        time: '4:00–5:00',
        startTime: '16:00',
        endTime: '17:00',
        isCommon: true,
        type: 'sports',
        label: 'Cocurricular Activities / Sports Time',
      },
    ],
  },
  {
    day: 'Thursday',
    rows: [
      {
        time: '1:50–2:50',
        startTime: '13:50',
        endTime: '14:50',
        batchA: { type: 'library', label: 'Library Time' },
        batchB: { subject: 'OSY', room: 'CL5', batch: 'B', startTime: '13:50', endTime: '14:50' },
        batchC: { subject: 'STE', room: 'CL7', batch: 'C', startTime: '13:50', endTime: '14:50' },
      },
      {
        time: '4:00–5:00',
        startTime: '16:00',
        endTime: '17:00',
        batchA: { subject: 'SPI', room: 'CL1', batch: 'A', startTime: '16:00', endTime: '17:00' },
        batchB: { subject: 'SPI', room: 'CL5', batch: 'B', startTime: '16:00', endTime: '17:00' },
        batchC: { subject: 'SPI', room: 'CL7', batch: 'C', startTime: '16:00', endTime: '17:00' },
      },
    ],
  },
  {
    day: 'Friday',
    rows: [
      {
        time: '1:50–2:50',
        startTime: '13:50',
        endTime: '14:50',
        batchA: { subject: 'ENDS', room: '109', batch: 'A', startTime: '13:50', endTime: '14:50' },
        batchB: { subject: 'STE', room: 'CL7', batch: 'B', startTime: '13:50', endTime: '14:50' },
        batchC: { subject: 'ACN', room: 'CL5', batch: 'C', startTime: '13:50', endTime: '14:50' },
      },
    ],
  },
];

/**
 * Returns all active timetable sessions for a given weekday name (e.g. 'Monday', 'Tuesday', etc.)
 * Filtering out off/library/sports slots so only teachable lectures and practicals are returned.
 */
export function getTeachableSessionsForDay(dayName) {
  const sessions = [];

  // Morning lectures
  const morningDay = MORNING_SCHEDULE.find((d) => d.day.toLowerCase() === dayName.toLowerCase());
  if (morningDay && morningDay.slots) {
    morningDay.slots.forEach((slot, index) => {
      if (!slot.isOff && slot.subject) {
        sessions.push({
          id: `lec-${slot.startTime}-${slot.endTime}-${slot.subject}`,
          sessionType: 'LECTURE',
          subjectCode: slot.subject,
          subjectName: SUBJECT_NAMES[slot.subject] || slot.subject,
          room: slot.room,
          batch: null,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timeDisplay: MORNING_SLOTS[index] || `${slot.startTime}–${slot.endTime}`,
        });
      }
    });
  }

  // Afternoon practicals
  const afternoonDay = AFTERNOON_SCHEDULE.find((d) => d.day.toLowerCase() === dayName.toLowerCase());
  if (afternoonDay && afternoonDay.rows) {
    afternoonDay.rows.forEach((row) => {
      ['batchA', 'batchB', 'batchC'].forEach((batchKey) => {
        const item = row[batchKey];
        if (item && item.subject && !item.type) {
          sessions.push({
            id: `prac-${item.startTime}-${item.endTime}-${item.subject}-batch-${item.batch}`,
            sessionType: 'PRACTICAL',
            subjectCode: item.subject,
            subjectName: SUBJECT_NAMES[item.subject] || item.subject,
            room: item.room,
            batch: item.batch,
            startTime: item.startTime,
            endTime: item.endTime,
            timeDisplay: row.time || `${item.startTime}–${item.endTime}`,
          });
        }
      });
    });
  }

  return sessions;
}
