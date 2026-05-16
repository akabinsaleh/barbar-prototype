// Prototype data — services, barbers, slot generator.
// All user-facing strings have an `i18n` key; UI looks them up in i18n.js.

export const CURRENCY = 'SAR';

export const services = [
  { id: 'classic',  i18n: 'services.classic',  durationMin: 30, price: 60 },
  { id: 'beard',    i18n: 'services.beard',    durationMin: 20, price: 35 },
  { id: 'shave',    i18n: 'services.shave',    durationMin: 40, price: 75 },
  { id: 'combo',    i18n: 'services.combo',    durationMin: 50, price: 90 },
  { id: 'kids',     i18n: 'services.kids',     durationMin: 25, price: 45 },
];

export const barbers = [
  { id: 'ahmed',  i18n: 'barbers.ahmed',  initials: 'A'  },
  { id: 'khalid', i18n: 'barbers.khalid', initials: 'K'  },
  { id: 'yousef', i18n: 'barbers.yousef', initials: 'Y'  },
  { id: 'omar',   i18n: 'barbers.omar',   initials: 'O'  },
];

export function nextDays(count = 14, from = new Date()) {
  const days = [];
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

// Slots: 10:00 → 21:00 every 30 min.
// Fridays (getDay()===5) closed before 14:00 — gives the demo some variety.
export function slotsForDate(date) {
  const isFriday = date.getDay() === 5;
  const slots = [];
  for (let h = 10; h <= 20; h++) {
    for (const m of [0, 30]) {
      const closed = isFriday && h < 14;
      slots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        disabled: closed,
      });
    }
  }
  slots.push({ time: '21:00', disabled: isFriday });
  return slots;
}
