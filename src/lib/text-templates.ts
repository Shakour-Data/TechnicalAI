// ═════════════════════════════════════════════════════════════════════════════════
// Text Templates — 5 Analysis Styles
// ═════════════════════════════════════════════════════════════════════════════════

export interface TemplateSection {
  id: string;
  title: string;
  requiredData: string[];
  maxLength: number;
  minLength: number;
}

export interface TextTemplate {
  id: string;
  style: string;
  styleEn: string;
  description: string;
  sections: TemplateSection[];
  totalMaxWords: number;
}

export const TEXT_TEMPLATES: TextTemplate[] = [
  // ─── 1. Executive Decision Style ───
  {
    id: 'executive',
    style: 'اجرایی و تصمیم‌گیری',
    styleEn: 'Executive Decision',
    description: 'مختصر، متمرکز بر تصمیم، تأکید بر ریسک',
    totalMaxWords: 400,
    sections: [
      { id: 'exec_summary', title: 'خلاصه اجرایی', requiredData: ['instrument', 'price', 'decision', 'confidence'], maxLength: 100, minLength: 50 },
      { id: 'key_signals', title: 'سیگنال‌های کلیدی', requiredData: ['rsi', 'macd', 'adx', 'trend'], maxLength: 150, minLength: 80 },
      { id: 'action', title: 'توصیه عملی', requiredData: ['entry', 'stopLoss', 'takeProfit', 'riskReward'], maxLength: 150, minLength: 80 },
    ],
  },

  // ─── 2. Technical Analytical Style ───
  {
    id: 'technical',
    style: 'تحلیلی-تکنیکال',
    styleEn: 'Technical Analytical',
    description: 'جزئیات کامل فنی، تمام اندیکاتورها و الگوها',
    totalMaxWords: 1200,
    sections: [
      { id: 'tech_overview', title: 'نمای کلی', requiredData: ['instrument', 'price', 'trend'], maxLength: 150, minLength: 80 },
      { id: 'tech_trend', title: 'تحلیل روند و ساختار بازار', requiredData: ['trend', 'trendStrength', 'maPosition'], maxLength: 200, minLength: 120 },
      { id: 'tech_levels', title: 'تحلیل سطوح کلیدی', requiredData: ['supports', 'resistances', 'srStrength'], maxLength: 150, minLength: 80 },
      { id: 'tech_patterns', title: 'الگوهای قیمتی تشخیص‌داده‌شده', requiredData: ['classicPatterns', 'harmonicPatterns', 'candlePatterns'], maxLength: 200, minLength: 100 },
      { id: 'tech_scenarios', title: 'سناریوهای قیمتی', requiredData: ['scenarios', 'v11Probabilities'], maxLength: 250, minLength: 150 },
      { id: 'tech_entry_exit', title: 'نقاط ورود و خروج', requiredData: ['entry', 'stopLoss', 'takeProfit', 'positionSize'], maxLength: 150, minLength: 80 },
      { id: 'tech_conclusion', title: 'نتیجه‌گیری', requiredData: ['decision', 'confidence'], maxLength: 100, minLength: 50 },
    ],
  },

  // ─── 3. Forecast Style ───
  {
    id: 'forecast',
    style: 'پیش‌بینی و آینده‌نگر',
    styleEn: 'Forecast',
    description: 'تأکید بر پیش‌بینی‌های آینده و سناریوها',
    totalMaxWords: 1000,
    sections: [
      { id: 'fc_overview', title: 'چشم‌انداز کلی', requiredData: ['instrument', 'price', 'trend'], maxLength: 150, minLength: 80 },
      { id: 'fc_price_forecast', title: 'پیش‌بینی قیمت', requiredData: ['day1', 'day5', 'day10', 'day30'], maxLength: 200, minLength: 120 },
      { id: 'fc_scenarios', title: 'سناریوهای محتمل', requiredData: ['scenarios', 'v11Probabilities'], maxLength: 300, minLength: 180 },
      { id: 'fc_turning_points', title: 'نقاط عطف آینده', requiredData: ['supports', 'resistances', 'patterns'], maxLength: 150, minLength: 80 },
      { id: 'fc_conclusion', title: 'جمع‌بندی و توصیه‌ها', requiredData: ['decision', 'confidence'], maxLength: 100, minLength: 50 },
    ],
  },

  // ─── 4. Trading Operations Style ───
  {
    id: 'trading',
    style: 'معاملاتی و عملیاتی',
    styleEn: 'Trading Operations',
    description: 'تأکید بر نقاط ورود/خروج و مدیریت ریسک عملیاتی',
    totalMaxWords: 600,
    sections: [
      { id: 'tr_signal_summary', title: 'خلاصه سیگنال', requiredData: ['action', 'confidence', 'entry', 'stopLoss'], maxLength: 100, minLength: 50 },
      { id: 'tr_quick_analysis', title: 'تحلیل سریع', requiredData: ['rsi', 'macd', 'adx', 'trend'], maxLength: 150, minLength: 80 },
      { id: 'tr_trading_scenarios', title: 'سناریوهای معاملاتی', requiredData: ['scenarios', 'v11Probabilities'], maxLength: 150, minLength: 80 },
      { id: 'tr_execution_entry', title: 'دستورات ورود', requiredData: ['entry', 'confirmation'], maxLength: 80, minLength: 40 },
      { id: 'tr_execution_exit', title: 'دستورات خروج', requiredData: ['stopLoss', 'takeProfit'], maxLength: 80, minLength: 40 },
      { id: 'tr_cancellation', title: 'شرایط لغو معامله', requiredData: ['cancellationConditions'], maxLength: 40, minLength: 20 },
    ],
  },

  // ─── 5. Educational-Interpretive Style ───
  {
    id: 'educational',
    style: 'آموزشی-تفسیری',
    styleEn: 'Educational-Interpretive',
    description: 'توضیح مفاهیم به زبان ساده، تفسیر سیگنال‌ها با مثال',
    totalMaxWords: 1500,
    sections: [
      { id: 'edu_introduction', title: 'مقدمه', requiredData: ['instrument', 'price'], maxLength: 120, minLength: 60 },
      { id: 'edu_key_concepts', title: 'مفاهیم کلیدی', requiredData: ['trend', 'rsi', 'macd'], maxLength: 200, minLength: 120 },
      { id: 'edu_step1_trend', title: 'مرحله ۱: بررسی روند', requiredData: ['trend', 'trendStrength', 'maPosition'], maxLength: 200, minLength: 120 },
      { id: 'edu_step2_indicators', title: 'مرحله ۲: تحلیل اندیکاتورها', requiredData: ['rsi', 'macd', 'adx', 'stoch', 'bb'], maxLength: 250, minLength: 150 },
      { id: 'edu_step3_patterns', title: 'مرحله ۳: تشخیص الگوها', requiredData: ['patterns'], maxLength: 200, minLength: 120 },
      { id: 'edu_step4_scenarios', title: 'مرحله ۴: سناریوهای قیمتی', requiredData: ['scenarios', 'v11Probabilities'], maxLength: 250, minLength: 150 },
      { id: 'edu_summary', title: 'جمع‌بندی برای مبتدیان', requiredData: ['decision', 'confidence', 'riskManagement'], maxLength: 150, minLength: 80 },
    ],
  },
];

/**
 * Get template by style name (Persian).
 * Falls back to 'technical' if not found.
 */
export function getTemplateForStyle(style: string): TextTemplate {
  return TEXT_TEMPLATES.find(t => t.style === style) ?? TEXT_TEMPLATES[1]; // default: technical
}

/**
 * Get template by ID.
 */
export function getTemplateById(id: string): TextTemplate {
  return TEXT_TEMPLATES.find(t => t.id === id) ?? TEXT_TEMPLATES[1];
}
