export function q(n: number) {
  return `Q${n.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function pct(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export function fmtDate(iso: string) {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}
