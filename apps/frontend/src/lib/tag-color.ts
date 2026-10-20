function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Black or white, whichever reads better on a `#rrggbb` background. */
export function textColorFor(hex: string): "#000000" | "#ffffff" {
  const body = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return "#000000";
  const luminance = 0.2126 * channel(body, 0) + 0.7152 * channel(body, 2) + 0.0722 * channel(body, 4);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
