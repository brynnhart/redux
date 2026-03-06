import { config } from '../config.js';
export function getTodayDayKey(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: config.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
}
export function getDayIndexFromDayKey(dayKey) {
    const parsed = new Date(`${dayKey}T00:00:00.000Z`);
    return Math.floor(parsed.getTime() / 86400000);
}
