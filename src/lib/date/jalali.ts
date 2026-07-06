const PERSIAN_EPOCH = 1948320;
const PERSIAN_NUM_DAYS = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];

function div(a: number, b: number): number {
  return ~~(a / b);
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

function pmod(a: number, b: number): number {
  return mod(mod(a, b) + b, b);
}

function normalizeMonth(year: number, month: number): [number, number] {
  month = month - 1;
  if (month < 0) {
    const oldMonth = month;
    month = pmod(month, 12);
    year -= div(month - oldMonth, 12);
  }
  if (month > 11) {
    year += div(month, 12);
    month = mod(month, 12);
  }
  return [year, month + 1];
}

function g2d(gy: number, gm: number, gd: number): number {
  const [ny, nm] = normalizeMonth(gy, gm);
  return (
    div(1461 * (ny + 4800 + div(nm - 14, 12)), 4) +
    div(367 * (nm - 2 - 12 * div(nm - 14, 12)), 12) -
    div(3 * div(ny + 4900 + div(nm - 14, 12), 100), 4) +
    gd - 32075
  );
}

function d2j(julianDay: number): { jy: number; jm: number; jd: number } {
  const daysSinceEpoch = julianDay - PERSIAN_EPOCH;
  let year = 1 + div(33 * daysSinceEpoch + 3, 12053);

  let dayOfYear = daysSinceEpoch - (365 * (year - 1) + div(8 * year + 21, 33));
  if (dayOfYear < 0) {
    year--;
    dayOfYear = daysSinceEpoch - (365 * (year - 1) + div(8 * year + 21, 33));
  }

  let month: number;
  if (dayOfYear < 216) {
    month = div(dayOfYear, 31);
  } else {
    month = div(dayOfYear - 6, 30);
  }

  const dayOfMonth = dayOfYear - (PERSIAN_NUM_DAYS[month] ?? 0) + 1;

  return { jy: year, jm: month + 1, jd: dayOfMonth };
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let L = jdn + 68569;
  const n = div(4 * L, 146097);
  L = L - div(146097 * n + 3, 4);
  const i = div(4000 * (L + 1), 1461001);
  L = L - div(1461 * i, 4) + 31;
  const j = div(80 * L, 2447);
  const gd = L - div(2447 * j, 80);
  L = div(j, 11);
  const gm = j + 2 - 12 * L;
  const gy = 100 * (n - 49) + i + L;
  return { gy, gm, gd };
}

function toJalaliFromG(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  return d2j(g2d(gy, gm, gd));
}

function toGregorianFromJ(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const PERSIAN_NUM = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];
  const month = jm - 1;
  let julianDay = PERSIAN_EPOCH - 1 + 365 * (jy - 1) + div(8 * jy + 21, 33);
  if (month !== 0) julianDay += (PERSIAN_NUM[month] ?? 0);
  julianDay += jd;
  return d2g(julianDay);
}

export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  return toJalaliFromG(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function toGregorian(jy: number, jm: number, jd: number): Date {
  const g = toGregorianFromJ(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

export function isLeapJalaliYear(jy: number): boolean {
  const m = ((25 * jy + 11) % 33 + 33) % 33;
  return (m < 8 && m >= 0) || m <= -27;
}

export function getDaysInMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

export function getMonthName(jm: number, locale: "fa-IR" | "en-US"): string {
  const names = locale === "fa-IR" ? [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
  ] : [
    "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
    "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand",
  ];
  return names[jm - 1] ?? "";
}

export function getDayName(dayIndex: number, locale: "fa-IR" | "en-US"): string {
  const names = locale === "fa-IR" ? ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return names[dayIndex] ?? "";
}

export function formatJalaliShort(date: Date, _locale: "fa-IR" | "en-US"): string {
  const j = toJalali(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
}
