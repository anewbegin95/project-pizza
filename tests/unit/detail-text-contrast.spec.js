import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const baseCss = readFileSync(new URL('../../resources/css/base.css', import.meta.url), 'utf8');
const detailCss = readFileSync(new URL('../../resources/css/popup_details.css', import.meta.url), 'utf8');

function token(css, name) {
  const value = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
  expect(value, `Expected ${name} to be a hex color`).toBeDefined();
  return value;
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

describe('detail date and location contrast', () => {
  it('meets WCAG AA normal-text contrast against the white surface', () => {
    const dateAndLocationRule = detailCss.match(/\.popup-detail__date,[\s\S]*?\{([^}]+)\}/)?.[1];
    expect(dateAndLocationRule, 'Expected date and location styles').toBeDefined();
    const colorToken = dateAndLocationRule.match(/color:\s*(var\(--[\w-]+)/)?.[1];
    expect(colorToken, 'Expected date and location to use a color token').toBeDefined();

    const foreground = token(baseCss, colorToken.slice(4));
    const background = token(baseCss, '--nyc-white');
    const contrast = (Math.max(luminance(foreground), luminance(background)) + 0.05)
      / (Math.min(luminance(foreground), luminance(background)) + 0.05);

    expect(contrast, `Expected contrast >= 4.5:1, received ${contrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
