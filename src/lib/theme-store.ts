import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Theme Presets ──────────────────────────────────────────────
export interface ThemeColors {
  // Page
  pageBg: string;
  pageFg: string;
  headerBg: string;
  headerBorder: string;
  headerFg: string;
  headerSubFg: string;
  footerBorder: string;
  footerFg: string;

  // Cards / Panels
  cardBg: string;
  cardBorder: string;
  cardFg: string;
  cardSubFg: string;

  // Accent
  primary: string;
  primaryFg: string;
  primaryBg: string;
  accent: string;
  accentFg: string;

  // Signal
  bullColor: string;
  bullBg: string;
  bearColor: string;
  bearBg: string;
  neutralColor: string;
  neutralBg: string;

  // Chart
  chartBg: string;
  chartGrid: string;
  chartText: string;
  chartCrosshair: string;

  // Borders / Inputs
  border: string;
  inputBorder: string;
  inputBg: string;

  // Misc
  logoBg: string;
  logoColor: string;
  logoBorderColor: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  colors: ThemeColors;
}

const whiteBlue: ThemeColors = {
  pageBg: '#f8fafc',
  pageFg: '#0f172a',
  headerBg: 'rgba(255,255,255,0.92)',
  headerBorder: '#e2e8f0',
  headerFg: '#0f172a',
  headerSubFg: '#64748b',
  footerBorder: '#e2e8f0',
  footerFg: '#94a3b8',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  cardFg: '#0f172a',
  cardSubFg: '#64748b',
  primary: '#2563eb',
  primaryFg: '#ffffff',
  primaryBg: '#eff6ff',
  accent: '#3b82f6',
  accentFg: '#ffffff',
  bullColor: '#16a34a',
  bullBg: '#f0fdf4',
  bearColor: '#dc2626',
  bearBg: '#fef2f2',
  neutralColor: '#d97706',
  neutralBg: '#fffbeb',
  chartBg: '#ffffff',
  chartGrid: '#f1f5f9',
  chartText: '#64748b',
  chartCrosshair: '#94a3b8',
  border: '#e2e8f0',
  inputBorder: '#cbd5e1',
  inputBg: '#ffffff',
  logoBg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
  logoColor: '#ffffff',
  logoBorderColor: '#2563eb',
};

const emeraldWhite: ThemeColors = {
  pageBg: '#f0fdf4',
  pageFg: '#052e16',
  headerBg: 'rgba(255,255,255,0.92)',
  headerBorder: '#bbf7d0',
  headerFg: '#052e16',
  headerSubFg: '#166534',
  footerBorder: '#bbf7d0',
  footerFg: '#4ade80',
  cardBg: '#ffffff',
  cardBorder: '#bbf7d0',
  cardFg: '#052e16',
  cardSubFg: '#166534',
  primary: '#059669',
  primaryFg: '#ffffff',
  primaryBg: '#ecfdf5',
  accent: '#10b981',
  accentFg: '#ffffff',
  bullColor: '#059669',
  bullBg: '#ecfdf5',
  bearColor: '#dc2626',
  bearBg: '#fef2f2',
  neutralColor: '#d97706',
  neutralBg: '#fffbeb',
  chartBg: '#ffffff',
  chartGrid: '#f0fdf4',
  chartText: '#166534',
  chartCrosshair: '#86efac',
  border: '#bbf7d0',
  inputBorder: '#86efac',
  inputBg: '#ffffff',
  logoBg: 'linear-gradient(135deg, #059669, #10b981)',
  logoColor: '#ffffff',
  logoBorderColor: '#059669',
};

const violetWhite: ThemeColors = {
  pageBg: '#faf5ff',
  pageFg: '#1e1b4b',
  headerBg: 'rgba(255,255,255,0.92)',
  headerBorder: '#e9d5ff',
  headerFg: '#1e1b4b',
  headerSubFg: '#6b21a8',
  footerBorder: '#e9d5ff',
  footerFg: '#a78bfa',
  cardBg: '#ffffff',
  cardBorder: '#e9d5ff',
  cardFg: '#1e1b4b',
  cardSubFg: '#6b21a8',
  primary: '#7c3aed',
  primaryFg: '#ffffff',
  primaryBg: '#f5f3ff',
  accent: '#8b5cf6',
  accentFg: '#ffffff',
  bullColor: '#16a34a',
  bullBg: '#f0fdf4',
  bearColor: '#dc2626',
  bearBg: '#fef2f2',
  neutralColor: '#d97706',
  neutralBg: '#fffbeb',
  chartBg: '#ffffff',
  chartGrid: '#faf5ff',
  chartText: '#6b21a8',
  chartCrosshair: '#c4b5fd',
  border: '#e9d5ff',
  inputBorder: '#c4b5fd',
  inputBg: '#ffffff',
  logoBg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
  logoColor: '#ffffff',
  logoBorderColor: '#7c3aed',
};

const amberDark: ThemeColors = {
  pageBg: '#0c0a09',
  pageFg: '#fef3c7',
  headerBg: 'rgba(28,25,23,0.95)',
  headerBorder: 'rgba(255,255,255,0.06)',
  headerFg: '#fde68a',
  headerSubFg: '#a8a29e',
  footerBorder: 'rgba(255,255,255,0.04)',
  footerFg: '#78716c',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardFg: '#fef3c7',
  cardSubFg: '#a8a29e',
  primary: '#f59e0b',
  primaryFg: '#1c1917',
  primaryBg: 'rgba(245,158,11,0.1)',
  accent: '#fbbf24',
  accentFg: '#1c1917',
  bullColor: '#4ade80',
  bullBg: 'rgba(74,222,128,0.08)',
  bearColor: '#f87171',
  bearBg: 'rgba(248,113,113,0.08)',
  neutralColor: '#fbbf24',
  neutralBg: 'rgba(251,191,36,0.08)',
  chartBg: '#0c0a09',
  chartGrid: 'rgba(255,255,255,0.04)',
  chartText: '#a8a29e',
  chartCrosshair: 'rgba(255,255,255,0.1)',
  border: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputBg: 'rgba(255,255,255,0.04)',
  logoBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
  logoColor: '#1c1917',
  logoBorderColor: 'rgba(245,158,11,0.3)',
};

const darkNavy: ThemeColors = {
  pageBg: '#0b1120',
  pageFg: '#e2e8f0',
  headerBg: 'rgba(15,23,42,0.95)',
  headerBorder: 'rgba(255,255,255,0.06)',
  headerFg: '#f8fafc',
  headerSubFg: '#64748b',
  footerBorder: 'rgba(255,255,255,0.04)',
  footerFg: '#475569',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardFg: '#f1f5f9',
  cardSubFg: '#94a3b8',
  primary: '#3b82f6',
  primaryFg: '#ffffff',
  primaryBg: 'rgba(59,130,246,0.1)',
  accent: '#60a5fa',
  accentFg: '#ffffff',
  bullColor: '#4ade80',
  bullBg: 'rgba(74,222,128,0.08)',
  bearColor: '#f87171',
  bearBg: 'rgba(248,113,113,0.08)',
  neutralColor: '#fbbf24',
  neutralBg: 'rgba(251,191,36,0.08)',
  chartBg: '#0f172a',
  chartGrid: 'rgba(255,255,255,0.04)',
  chartText: '#94a3b8',
  chartCrosshair: 'rgba(255,255,255,0.1)',
  border: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputBg: 'rgba(255,255,255,0.04)',
  logoBg: 'linear-gradient(135deg, #3b82f6, #6366f1)',
  logoColor: '#ffffff',
  logoBorderColor: 'rgba(59,130,246,0.3)',
};

// ─── Theme Presets List ─────────────────────────────────────────
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'white-blue', name: 'آبی و سفید', colors: whiteBlue },
  { id: 'emerald-white', name: 'سبز و سفید', colors: emeraldWhite },
  { id: 'violet-white', name: 'بنفش و سفید', colors: violetWhite },
  { id: 'amber-dark', name: 'طلایی تیره', colors: amberDark },
  { id: 'dark-navy', name: 'سرمه‌ای تیره', colors: darkNavy },
];

// ─── Store ──────────────────────────────────────────────────────
interface ThemeState {
  themeId: string;
  setTheme: (id: string) => void;
  getColors: () => ThemeColors;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId: 'white-blue',
      setTheme: (id: string) => set({ themeId: id }),
      getColors: () => {
        const { themeId } = get();
        return THEME_PRESETS.find(t => t.id === themeId)?.colors ?? whiteBlue;
      },
    }),
    { name: 'app-theme' }
  )
);

// ─── Helper Hook ─────────────────────────────────────────────────
export function useTheme() {
  const themeId = useThemeStore(s => s.themeId);
  const setTheme = useThemeStore(s => s.setTheme);
  const colors = useThemeStore(s => {
    return THEME_PRESETS.find(t => t.id === s.themeId)?.colors ?? whiteBlue;
  });
  const isDark = colors.chartBg !== '#ffffff';
  return { themeId, setTheme, colors, isDark };
}
