import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = __dirname;

const PALETTE = [
  '#f2f2f0', '#0d3a5c', '#0a2f4b', '#3f627d', '#4d6e85', '#c4cdd2',
  '#e0e3e4', '#60e4cf', '#ffffff', '#c2ced6', '#2f5672',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const code = files.filter((f) => /\.tsx?$/.test(f.path));
const css = files.filter((f) => f.path.endsWith('.css'));

describe('design contract', () => {
  it('uses no icon set but Lucide (react-icons/lu), and no legacy UI libraries', () => {
    const banned =
      /from ['"](lucide-react|react-icons\/(?!lu['"/])[^'"]*|@mui\/[^'"]*|@emotion\/[^'"]*|styled-components|formik|yup)['"]/;
    expect(banned.test("from 'react-icons/fa'")).toBe(true);
    expect(banned.test("from 'react-icons/lu'")).toBe(false);
    expect(code.filter((f) => banned.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('rounds no corners', () => {
    const rounded = /(?<![\w-])rounded(?!-none\b)(?:-[\w/[\]]+)?(?![\w])/;
    expect(code.filter((f) => rounded.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('casts no shadows apart from the button seam', () => {
    const hits = code
      .flatMap((f) => (f.text.match(/(?<![\w-])shadow(?:-[^\s'"`]+)?(?![\w])/g) ?? []).map((m) => `${f.path}: ${m}`))
      .filter((hit) => !hit.includes('shadow-[inset_1px_0_0'));
    expect(hits).toEqual([]);
  });

  it('uses no CSS box-shadow or gradients', () => {
    expect(css.filter((f) => /box-shadow|gradient\(/.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('uses no red, rose or pink colour utilities', () => {
    const red = /(?<![\w-])(?:bg|text|border|ring|outline|fill|stroke|decoration)-(?:red|rose|pink)-\d/;
    expect(code.filter((f) => red.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('defines the whole brand palette and a zero radius', () => {
    const styles = css.map((f) => f.text).join('\n').toLowerCase();
    for (const hex of PALETTE) expect(styles).toContain(hex);
    expect(styles).toContain('--radius: 0px');
  });

  it('uses no colour outside the brand palette', () => {
    const stray = [...code, ...css].flatMap((f) =>
      (f.text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
        .filter((hex) => !PALETTE.includes(hex.toLowerCase()))
        .map((hex) => `${f.path}: ${hex}`),
    );
    expect(stray).toEqual([]);
  });
});

describe('design contract: the palette cannot be bypassed', () => {
  const styles = css.map((f) => f.text).join('\n');
  const defaultPaletteUtility =
    /(?<![\w-])(?:bg|text|border|ring|outline|fill|stroke|decoration|divide|placeholder|caret|accent|from|via|to)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?![\w-])/;

  it('removes the default Tailwind palette, so an unknown colour class cannot compile', () => {
    expect(styles).toMatch(/--color-\*:\s*initial/);
  });

  it('uses no default-palette colour utilities (and the check catches them)', () => {
    expect(defaultPaletteUtility.test('bg-gray-100')).toBe(true);
    expect(defaultPaletteUtility.test('text-white')).toBe(true);
    expect(defaultPaletteUtility.test('bg-navy text-teal text-on-navy border-rule')).toBe(false);
    expect(code.filter((f) => defaultPaletteUtility.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('writes no colour functions other than the scrim and the button seam', () => {
    const functions = [...code, ...css]
      .flatMap((f) => f.text.match(/(?<![a-z])(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([^)]*\)/g) ?? [])
      .map((value) => value.replace(/[\s_]/g, ''))
      .sort();
    expect(functions).toEqual(['rgb(255255255/0.08)', 'rgb(31729/0.45)']);
  });

  it('declares no border-radius in CSS', () => {
    expect(/border-radius\s*:\s*(?!0\b)/.test(styles)).toBe(false);
  });
});
