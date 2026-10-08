// Small color-math helpers shared by BubbleVisual (icon.color: "auto") and,
// later, the skin builder's contrast warning (Part 4).

const hexToRgb = (hex: string): [number, number, number] | null => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

// WCAG relative luminance (0 = black, 1 = white).
export function relativeLuminance(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return 1;
    const [r, g, b] = rgb.map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Picks whichever of white/dark-ink reads better on the given fill color.
export function contrastingTextColor(fillHex: string, darkColor = "#1E2A4A", lightColor = "#FFFFFF"): string {
    return relativeLuminance(fillHex) > 0.5 ? darkColor : lightColor;
}

// WCAG contrast ratio between two colors, for the skin builder's warning.
export function contrastRatio(hexA: string, hexB: string): number {
    const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
}
