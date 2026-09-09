export type InstrumentCategory = 'stock' | 'etf' | 'bond' | 'future' | 'salaf' | 'mortgage' | 'index' | 'tse_index'
  | 'currency' | 'gold' | 'silver' | 'gold_etf'
  | 'crypto' | 'world_index' | 'foreign_stock' | 'forex' | 'energy' | 'metal' | 'commodity';

export function getCurrencyUnit(category?: string, isIndex?: boolean, isTgju?: boolean): string {
  if (isIndex || category === 'index' || category === 'tse_index') return 'واحد';
  if (category === 'world_index') return 'واحد';
  if (!category || !isTgju) return 'ریال'; // default: TSE instruments
  if (category === 'crypto') return 'تتر';
  if (category === 'currency') return 'تومان';
  if (category === 'gold' || category === 'silver' || category === 'gold_etf') return 'تومان';
  // Everything else (foreign_stock, forex, energy, metal, commodity)
  return 'دلار';
}
