'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search, X, TrendingUp, TrendingDown,
  BarChart3, Landmark, Building2, FileText,
  ChevronDown, Layers, ArrowUpDown, Coins, CircleDollarSign,
  Globe, Bitcoin, Fuel, Gem, Package, Earth, MapPin,
  Building, Zap, Clock, Star, Hash,
} from 'lucide-react';

/* --─ Types ---------------------------------------------- */

interface InstrumentItem {
  l18: string;
  l30: string;
  pl: number;
  pcp: number;
  tno: number;
  tvol: number;
  tval: number;
  cs: string;
  category: 'stock' | 'etf' | 'bond' | 'future' | 'salaf' | 'mortgage' | 'index'
    | 'currency' | 'gold' | 'silver' | 'gold_etf'
    | 'crypto' | 'world_index' | 'foreign_stock' | 'forex' | 'energy' | 'metal' | 'commodity'
    | 'yahoo_stock' | 'yahoo_etf';
  insCode?: string;
  tgjuKey?: string;
  finpySector?: string;
  finpyIndex?: string;
  webId?: string | number;
  isMainIndex?: boolean;
  index?: number;
  indexChange?: number;
  indexChangePercent?: number;
  indexMin?: number;
  indexMax?: number;
  yahooSymbol?: string;
  yahooCategory?: string;
  currency?: string;
  unit?: string;
  country?: string;
  countryEn?: string;
  exchange?: string;
  sector?: string;
  nameEn?: string;
}

interface InstrumentsData {
  indices: InstrumentItem[];
  stocks: InstrumentItem[];
  etfs: InstrumentItem[];
  bonds: InstrumentItem[];
  futures: InstrumentItem[];
  salaf: InstrumentItem[];
  mortgage: InstrumentItem[];
  industries: string[];
}

interface TgjuData {
  currencies: InstrumentItem[];
  gold: InstrumentItem[];
  silver: InstrumentItem[];
  goldEtfs: InstrumentItem[];
  crypto: InstrumentItem[];
  worldIndices: InstrumentItem[];
  foreignStocks: InstrumentItem[];
  forex: InstrumentItem[];
  energy: InstrumentItem[];
  metals: InstrumentItem[];
  commodities: InstrumentItem[];
  items: InstrumentItem[];
}

interface YahooData {
  yahooStocks: InstrumentItem[];
  yahooIndices: InstrumentItem[];
  yahooEnergy: InstrumentItem[];
  yahooMetals: InstrumentItem[];
  yahooCommodities: InstrumentItem[];
  yahooForex: InstrumentItem[];
  yahooCrypto: InstrumentItem[];
  yahooEtfs: InstrumentItem[];
  items: InstrumentItem[];
  worldIndices: InstrumentItem[];
  energy: InstrumentItem[];
  metals: InstrumentItem[];
  commodities: InstrumentItem[];
  forex: InstrumentItem[];
  crypto: InstrumentItem[];
}

interface SymbolSearchProps {
  onSelect?: (symbol: string, category?: string, insCode?: string, tgjuKey?: string, finpySector?: string, finpyIndex?: string, webId?: string | number, yahooSymbol?: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

/* --─ Constants ------------------------------------------ */

const MAX_RESULTS = 60;

const CATEGORIES = [
  { key: 'all',          label: 'همه',            icon: Layers },
  { key: 'indices',      label: 'شاخص‌ها',        icon: BarChart3 },
  { key: 'stocks',       label: 'سهام بورس',      icon: Building2 },
  { key: 'etf',          label: 'صندوق‌ها',       icon: Landmark },
  { key: 'currency',     label: 'ارز (ریال)',      icon: CircleDollarSign },
  { key: 'forex',        label: 'جفت ارز',        icon: Globe },
  { key: 'crypto',       label: 'کریپتو',         icon: Bitcoin },
  { key: 'gold',         label: 'طلا و سکه',      icon: Coins },
  { key: 'gold_etf',     label: 'صندوق طلا',      icon: Coins },
  { key: 'world_index',  label: 'شاخص جهانی',    icon: Globe },
  { key: 'energy',       label: 'نفت و انرژی',    icon: Fuel },
  { key: 'metal',        label: 'فلزات',         icon: Gem },
  { key: 'commodity',    label: 'کالا',           icon: Package },
  { key: 'bond',         label: 'اوراق بدهی',     icon: FileText },
  { key: 'yahoo_stock',  label: 'سهام جهانی',     icon: Earth },
  { key: 'yahoo_etf',    label: 'ETF جهانی',      icon: Landmark },
  { key: 'derivative',   label: 'مشتقه',         icon: ArrowUpDown },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const TGJU_CATEGORY_ITEMS = new Set<string>([
  'currency', 'gold', 'silver', 'gold_etf',
  'crypto', 'world_index', 'foreign_stock', 'forex', 'energy', 'metal', 'commodity',
]);

const TGJU_CATEGORIES = new Set<CategoryKey>([
  'currency', 'gold', 'gold_etf',
  'crypto', 'world_index', 'forex', 'energy', 'metal', 'commodity',
]);

const YAHOO_SPECIFIC_CATEGORIES = new Set<CategoryKey>(['yahoo_stock', 'yahoo_etf']);

const CATEGORY_COLORS: Record<string, string> = {
  stock: 'bg-blue-50 text-blue-700 border border-blue-100',
  etf: 'bg-purple-50 text-purple-700 border border-purple-100',
  bond: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  future: 'bg-orange-50 text-orange-700 border border-orange-100',
  salaf: 'bg-amber-50 text-amber-800 border border-amber-100',
  mortgage: 'bg-cyan-50 text-cyan-700 border border-cyan-100',
  index: 'bg-rose-50 text-rose-700 border border-rose-100',
  currency: 'bg-teal-50 text-teal-700 border border-teal-100',
  gold: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
  silver: 'bg-gray-100 text-gray-600 border border-gray-200',
  gold_etf: 'bg-amber-50 text-amber-800 border border-amber-100',
  crypto: 'bg-orange-50 text-orange-700 border border-orange-100',
  world_index: 'bg-sky-50 text-sky-700 border border-sky-100',
  forex: 'bg-violet-50 text-violet-700 border border-violet-100',
  energy: 'bg-red-50 text-red-700 border border-red-100',
  metal: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  commodity: 'bg-lime-50 text-lime-700 border border-lime-100',
  yahoo_stock: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  yahoo_etf: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100',
};

const CATEGORY_LABELS: Record<string, string> = {
  stock: 'سهام', etf: 'صندوق', bond: 'اخزا', future: 'آتی', salaf: 'سلف', mortgage: 'تسه',
  index: 'شاخص', currency: 'ارز', gold: 'طلا', silver: 'نقره', gold_etf: 'صندوق طلا',
  crypto: 'کریپتو', world_index: 'شاخص جهانی', forex: 'فارکس', energy: 'انرژی',
  metal: 'فلز', commodity: 'کالا', yahoo_stock: 'سهام جهانی', yahoo_etf: 'ETF جهانی',
};

const SOURCE_STYLES: Record<string, string> = {
  tse: 'bg-amber-100 text-amber-800 border-amber-200',
  tgju: 'bg-teal-100 text-teal-700 border-teal-200',
  yahoo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const COUNTRY_FLAGS: Record<string, string> = {
  'US': '\u{1F1FA}\u{1F1F8}', 'آمریکا': '\u{1F1FA}\u{1F1F8}',
  'UK': '\u{1F1EC}\u{1F1E7}', 'انگلستان': '\u{1F1EC}\u{1F1E7}',
  'DE': '\u{1F1E9}\u{1F1EA}', 'آلمان': '\u{1F1E9}\u{1F1EA}',
  'FR': '\u{1F1EB}\u{1F1F7}', 'فرانسه': '\u{1F1EB}\u{1F1F7}',
  'JP': '\u{1F1EF}\u{1F1F5}', 'ژاپن': '\u{1F1EF}\u{1F1F5}',
  'CN': '\u{1F1E8}\u{1F1F3}', 'چین': '\u{1F1E8}\u{1F1F3}',
  'KR': '\u{1F1F0}\u{1F1F7}', 'کره جنوبی': '\u{1F1F0}\u{1F1F7}',
  'IN': '\u{1F1EE}\u{1F1F3}', 'هند': '\u{1F1EE}\u{1F1F3}',
  'TW': '\u{1F1F9}\u{1F1FC}', 'تایوان': '\u{1F1F9}\u{1F1FC}',
  'AU': '\u{1F1E6}\u{1F1FA}', 'استرالیا': '\u{1F1E6}\u{1F1FA}',
  'SA': '\u{1F1F8}\u{1F1E6}', 'عربستان': '\u{1F1F8}\u{1F1E6}',
  'AE': '\u{1F1E6}\u{1F1EA}', 'امارات': '\u{1F1E6}\u{1F1EA}',
  'TR': '\u{1F1F9}\u{1F1F7}', 'ترکیه': '\u{1F1F9}\u{1F1F7}',
  'BR': '\u{1F1E7}\u{1F1F7}', 'برزیل': '\u{1F1E7}\u{1F1F7}',
  'NL': '\u{1F1F3}\u{1F1F1}', 'هلند': '\u{1F1F3}\u{1F1F1}',
  'CH': '\u{1F1E8}\u{1F1ED}', 'سوئیس': '\u{1F1E8}\u{1F1ED}',
  'ES': '\u{1F1EA}\u{1F1F8}', 'اسپانیا': '\u{1F1EA}\u{1F1F8}',
  'IT': '\u{1F1EE}\u{1F1F9}', 'ایتالیا': '\u{1F1EE}\u{1F1F9}',
  'HK': '\u{1F1ED}\u{1F1F0}', 'هنگ کنگ': '\u{1F1ED}\u{1F1F0}',
  'RU': '\u{1F1F7}\u{1F1FA}', 'روسیه': '\u{1F1F7}\u{1F1FA}',
  'SG': '\u{1F1F8}\u{1F1EC}', 'سنگاپور': '\u{1F1F8}\u{1F1EC}',
  'MY': '\u{1F1F2}\u{1F1FE}', 'مالزی': '\u{1F1F2}\u{1F1FE}',
  'TH': '\u{1F1F9}\u{1F1ED}', 'تایلند': '\u{1F1F9}\u{1F1ED}',
  'ID': '\u{1F1EE}\u{1F1E9}', 'اندونزی': '\u{1F1EE}\u{1F1E9}',
  'MX': '\u{1F1F2}\u{1F1FD}', 'مکزیک': '\u{1F1F2}\u{1F1FD}',
  'IR': '\u{1F1EE}\u{1F1F7}',
  'INTL': '\u{1F30D}', 'بین‌المللی': '\u{1F30D}',
};

function getCountryFlag(country?: string): string {
  if (!country) return '';
  return COUNTRY_FLAGS[country] || '';
}

/* --─ Helpers -------------------------------------------- */

function formatNum(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(num);
}

function formatIdx(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(num);
}

function Spinner() {
  return (
    <svg className='animate-spin text-gray-400' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' width='16' height='16'>
      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
    </svg>
  );
}

function getSource(item: InstrumentItem): 'tse' | 'tgju' | 'yahoo' {
  if (item.yahooSymbol || item.category === 'yahoo_stock' || item.category === 'yahoo_etf') return 'yahoo';
  if (TGJU_CATEGORY_ITEMS.has(item.category) || item.tgjuKey) return 'tgju';
  return 'tse';
}

/* --─ Recent Searches ------------------------------------ */

const RECENT_KEY = 'fin-search-recent';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(RECENT_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

function addRecentSearch(name: string) {
  if (typeof window === 'undefined' || !name) return;
  try {
    let list = getRecentSearches();
    list = list.filter((r) => r !== name);
    list.unshift(name);
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

/* --─ Component ------------------------------------------ */

export default function SymbolSearch({
  onSelect,
  placeholder = 'جستجوی ابزار مالی ...',
  className,
  compact = false,
}: SymbolSearchProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<InstrumentItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [totalMatched, setTotalMatched] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState<CategoryKey>('all');
  const [activeIndustry, setActiveIndustry] = React.useState<string | null>(null);
  const [activeCountry, setActiveCountry] = React.useState<string | null>(null);
  const [activeSector, setActiveSector] = React.useState<string | null>(null);
  const [showIndustryPicker, setShowIndustryPicker] = React.useState(false);
  const [showSectorPicker, setShowSectorPicker] = React.useState(false);
  const [recentSearches] = React.useState(() => getRecentSearches());

  const cacheRef = React.useRef<InstrumentsData | null>(null);
  const tgjuCacheRef = React.useRef<TgjuData | null>(null);
  const yahooCacheRef = React.useRef<YahooData | null>(null);
  const fetchRef = React.useRef<Promise<InstrumentsData> | null>(null);
  const tgjuFetchRef = React.useRef<Promise<TgjuData | null> | null>(null);
  const yahooFetchRef = React.useRef<Promise<YahooData | null> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  /* -- Derived lists -- */
  const yahooCountries = React.useMemo(() => {
    if (!yahooCacheRef.current) return [];
    const set = new Set<string>();
    const all = [...yahooCacheRef.current.yahooStocks, ...yahooCacheRef.current.yahooEtfs];
    all.forEach((s) => { if (s.country) set.add(s.country); });
    return Array.from(set);
  }, [open]);

   const yahooSectors = React.useMemo(() => {
    if (!yahooCacheRef.current) return [];
    const set = new Set<string>();
    yahooCacheRef.current.yahooStocks.forEach((s) => { if (s.sector) set.add(s.sector); });
    return Array.from(set);
  }, [open]);

  /* -- Data fetching -- */
  const fetchData = React.useCallback(async (): Promise<InstrumentsData> => {
    if (cacheRef.current) return cacheRef.current;
    if (fetchRef.current) return fetchRef.current;
    const p = async () => {
      try { const r = await fetch('/api/instruments'); if (!r.ok) throw new Error(`${r.status}`); const d: InstrumentsData = await r.json(); cacheRef.current = d; return d; }
      finally { fetchRef.current = null; }
    };
    fetchRef.current = p(); return fetchRef.current;
  }, []);

  const fetchTgjuData = React.useCallback(async (): Promise<TgjuData | null> => {
    if (tgjuCacheRef.current) return tgjuCacheRef.current;
    if (tgjuFetchRef.current) return tgjuFetchRef.current;
    const p = async () => {
      try { const r = await fetch('/api/tgju-instruments'); if (!r.ok) return null; const d: TgjuData = await r.json(); tgjuCacheRef.current = d; return d; }
      catch { return null; } finally { tgjuFetchRef.current = null; }
    };
    tgjuFetchRef.current = p(); return p();
  }, []);

  const fetchYahooData = React.useCallback(async (): Promise<YahooData | null> => {
    if (yahooCacheRef.current) return yahooCacheRef.current;
    if (yahooFetchRef.current) return yahooFetchRef.current;
    const p = async () => {
      try { const r = await fetch('/api/yahoo-instruments'); if (!r.ok) return null; const d = await r.json() as YahooData; yahooCacheRef.current = d; return d; }
      catch { return null; } finally { yahooFetchRef.current = null; }
    };
    yahooFetchRef.current = p(); return p();
  }, []);

  /* -- Get items for category -- */
  const getItemsForCategory = React.useCallback(async (cat: CategoryKey): Promise<InstrumentItem[]> => {
    if (cat === 'yahoo_stock') {
      const yahoo = yahooCacheRef.current || await fetchYahooData();
      let items = yahoo?.yahooStocks || [];
      if (activeCountry) items = items.filter((s) => s.country === activeCountry);
      if (activeSector) items = items.filter((s) => s.sector === activeSector);
      return items;
    }
    if (cat === 'yahoo_etf') {
      const yahoo = yahooCacheRef.current || await fetchYahooData();
      let items = yahoo?.yahooEtfs || [];
      if (activeCountry) items = items.filter((s) => s.country === activeCountry);
      return items;
    }

    if (TGJU_CATEGORIES.has(cat)) {
      const tgju = tgjuCacheRef.current || await fetchTgjuData();
      const yahoo = yahooCacheRef.current || await fetchYahooData();
      if (!tgju && !yahoo) return [];
      let items: InstrumentItem[] = [];
      switch (cat) {
        case 'currency': items = tgju?.currencies || []; break;
        case 'gold': items = [...(tgju?.gold || []), ...(tgju?.silver || [])]; break;
        case 'gold_etf': items = tgju?.goldEtfs || []; break;
        case 'crypto': items = [...(tgju?.crypto || []), ...(yahoo?.yahooCrypto || [])]; break;
        case 'world_index': items = [...(tgju?.worldIndices || []), ...(tgju?.foreignStocks || []), ...(yahoo?.yahooIndices || [])]; break;
        case 'forex': items = [...(tgju?.forex || []), ...(yahoo?.yahooForex || [])]; break;
        case 'energy': items = [...(tgju?.energy || []), ...(yahoo?.yahooEnergy || [])]; break;
        case 'metal': items = [...(tgju?.metals || []), ...(yahoo?.yahooMetals || [])]; break;
        case 'commodity': items = [...(tgju?.commodities || []), ...(yahoo?.yahooCommodities || [])]; break;
        default: items = [];
      }
      return items;
    }

    const data = cacheRef.current || await fetchData();
    switch (cat) {
      case 'indices': return data.indices;
      case 'stocks': return activeIndustry ? data.stocks.filter((s) => s.cs === activeIndustry) : data.stocks;
      case 'etf': return data.etfs;
      case 'bond': return [...data.bonds, ...data.mortgage];
      case 'derivative': return [...data.futures, ...data.salaf];
      case 'all':
      default: {
        const tgju = tgjuCacheRef.current || await fetchTgjuData();
        const yahoo = yahooCacheRef.current || await fetchYahooData();
        return [
          ...data.indices, ...data.stocks, ...data.etfs,
          ...(tgju?.currencies || []), ...(tgju?.forex || []), ...(yahoo?.yahooForex || []),
          ...(tgju?.crypto || []), ...(yahoo?.yahooCrypto || []),
          ...(tgju?.gold || []), ...(tgju?.silver || []), ...(tgju?.goldEtfs || []),
          ...(tgju?.worldIndices || []), ...(yahoo?.yahooIndices || []),
          ...(tgju?.energy || []), ...(yahoo?.yahooEnergy || []),
          ...(tgju?.metals || []), ...(yahoo?.yahooMetals || []),
          ...(tgju?.commodities || []), ...(yahoo?.yahooCommodities || []),
          ...(yahoo?.yahooStocks || []), ...(yahoo?.yahooEtfs || []),
          ...data.bonds, ...data.futures, ...data.salaf, ...data.mortgage,
        ];
      }
    }
  }, [activeIndustry, activeCountry, activeSector, fetchData, fetchTgjuData, fetchYahooData]);

  /* -- Advanced multi-field search -- */
  const doFilter = React.useCallback((items: InstrumentItem[], q: string) => {
    const n = q.trim().toLowerCase();
    const terms = n.split(/\s+/);

    const scoreAndFilter = (item: InstrumentItem) => {
      const fields = [item.l18, item.l30, item.cs, item.yahooSymbol || '', item.nameEn || '', item.exchange || '', item.country || '', item.countryEn || '', item.sector || ''];
      const fullText = fields.join(' ').toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (!term) continue;
        if (item.l18.toLowerCase().includes(term)) score += 10;
        if (item.nameEn?.toLowerCase().includes(term)) score += 8;
        if (item.yahooSymbol?.toLowerCase() === term) score += 20;
        else if (item.yahooSymbol?.toLowerCase().includes(term)) score += 15;
        if (item.l30.toLowerCase().includes(term)) score += 7;
        if (item.exchange?.toLowerCase().includes(term)) score += 5;
        if (item.country?.toLowerCase().includes(term)) score += 6;
        if (item.countryEn?.toLowerCase() === term) score += 15;
        else if (item.countryEn?.toLowerCase().includes(term)) score += 4;
        if (item.sector?.toLowerCase().includes(term)) score += 5;
        if (item.cs?.toLowerCase().includes(term)) score += 6;

        if (!item.l18.toLowerCase().includes(term) && !item.l30.toLowerCase().includes(term) &&
            !item.cs?.toLowerCase().includes(term) && !(item.yahooSymbol?.toLowerCase().includes(term)) &&
            !(item.nameEn?.toLowerCase().includes(term)) && !(item.exchange?.toLowerCase().includes(term)) &&
            !(item.country?.toLowerCase().includes(term)) && !(item.countryEn?.toLowerCase().includes(term)) &&
            !(item.sector?.toLowerCase().includes(term))) {
          return null;
        }
      }
      return score;
    };

    const scored = items.map((item) => ({ item, score: scoreAndFilter(item) }))
      .filter((r): r is { item: InstrumentItem; score: number } => r.score !== null && r.score > 0)
      .sort((a, b) => b.score - a.score);

    setTotalMatched(scored.length);
    setResults(scored.slice(0, MAX_RESULTS).map((s) => s.item));
    setActiveIndex(-1);
  }, []);

  /* -- Popular -- */
  const getPopular = React.useCallback(async () => {
    const data = cacheRef.current || await fetchData();
    const tgju = tgjuCacheRef.current;
    const yahoo = yahooCacheRef.current;
    const all = [
      ...(data.indices.map((i) => ({ ...i, tval: i.index || 0 }))), ...data.stocks, ...data.etfs,
      ...(tgju?.currencies || []), ...(tgju?.crypto?.slice(0, 5) || []), ...(tgju?.gold?.slice(0, 3) || []),
      ...(yahoo?.yahooStocks?.slice(0, 8) || []), ...(yahoo?.yahooIndices?.slice(0, 5) || []),
    ];
    const sorted = [...all].sort((a, b) => (b.tval || 0) - (a.tval || 0)).slice(0, 20);
    setResults(sorted); setTotalMatched(all.length);
  }, [fetchData]);

  /* -- Show dropdown -- */
  const showDropdown = React.useCallback(async (q: string) => {
    setOpen(true);
    await Promise.all([fetchData(), fetchTgjuData(), fetchYahooData()]);
    const items = await getItemsForCategory(activeCategory);
    if (q.trim().length === 0) {
      if (activeCategory === 'all') await getPopular();
      else { setResults(items.slice(0, MAX_RESULTS)); setTotalMatched(items.length); }
    } else { doFilter(items, q); }
    setLoading(false);
  }, [fetchData, fetchTgjuData, getItemsForCategory, activeCategory, getPopular, doFilter]);

  /* -- Handlers -- */
  const handleCategoryChange = React.useCallback(async (cat: CategoryKey) => {
    setActiveCategory(cat);
    if (cat !== 'stocks') setActiveIndustry(null);
    if (!YAHOO_SPECIFIC_CATEGORIES.has(cat)) { setActiveCountry(null); setActiveSector(null); }
    setShowIndustryPicker(false); setShowSectorPicker(false);
    const items = await getItemsForCategory(cat);
    if (query.trim().length > 0) doFilter(items, query);
    else if (cat === 'all') await getPopular();
    else { setResults(items.slice(0, MAX_RESULTS)); setTotalMatched(items.length); }
    setActiveIndex(-1);
  }, [getItemsForCategory, query, doFilter, getPopular]);

  const handleIndustryChange = React.useCallback((industry: string | null) => {
    setActiveIndustry(industry); setShowIndustryPicker(false);
    if (cacheRef.current) {
      const items = industry ? cacheRef.current.stocks.filter((s) => s.cs === industry) : cacheRef.current.stocks;
      if (query.trim().length > 0) doFilter(items, query);
      else { setResults(items.slice(0, MAX_RESULTS)); setTotalMatched(items.length); }
      setActiveIndex(-1);
    }
  }, [query, doFilter]);

  const handleCountryChange = React.useCallback((country: string | null) => {
    setActiveCountry(country);
    const yahoo = yahooCacheRef.current; if (!yahoo) return;
    let items: InstrumentItem[] = activeCategory === 'yahoo_etf' ? [...(yahoo.yahooEtfs || [])] : [...(yahoo.yahooStocks || [])];
    if (country) items = items.filter((s) => s.country === country);
    if (activeSector) items = items.filter((s) => s.sector === activeSector);
    if (query.trim().length > 0) doFilter(items, query);
    else { setResults(items.slice(0, MAX_RESULTS)); setTotalMatched(items.length); }
    setActiveIndex(-1);
  }, [activeCategory, activeSector, query, doFilter]);

  const handleSectorChange = React.useCallback((sector: string | null) => {
    setActiveSector(sector); setShowSectorPicker(false);
    const yahoo = yahooCacheRef.current; if (!yahoo) return;
    let items: InstrumentItem[] = [...(yahoo.yahooStocks || [])];
    if (activeCountry) items = items.filter((s) => s.country === activeCountry);
    if (sector) items = items.filter((s) => s.sector === sector);
    if (query.trim().length > 0) doFilter(items, query);
    else { setResults(items.slice(0, MAX_RESULTS)); setTotalMatched(items.length); }
    setActiveIndex(-1);
  }, [activeCountry, query, doFilter]);

  const handleChange = React.useCallback((value: string) => {
    setQuery(value);
    getItemsForCategory(activeCategory).then((items) => {
      if (value.trim().length === 0) { if (activeCategory === 'all') getPopular(); else { setResults(items.slice(0, MAX_RESULTS)); setTotalMatched(items.length); } }
      else doFilter(items, value);
    });
  }, [activeCategory, getItemsForCategory, getPopular, doFilter]);

  const handleFocus = React.useCallback(() => { setLoading(true); showDropdown(query); }, [query, showDropdown]);

  const selectSymbol = React.useCallback((s: InstrumentItem) => {
    setQuery(s.l18); setOpen(false); addRecentSearch(s.l18);
    onSelect?.(s.l18, s.category, s.insCode, s.tgjuKey, s.finpySector, s.finpyIndex, s.webId, s.yahooSymbol);
    inputRef.current?.blur();
  }, [onSelect]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); handleFocus(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((p) => p < results.length - 1 ? p + 1 : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((p) => p > 0 ? p - 1 : results.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) selectSymbol(results[activeIndex]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); inputRef.current?.blur(); }
  }, [open, results, activeIndex, selectSymbol, handleFocus]);

  React.useEffect(() => { if (activeIndex >= 0) itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false); setShowIndustryPicker(false); setShowSectorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const clear = () => { setQuery(''); setActiveIndustry(null); setActiveCountry(null); setActiveSector(null); setActiveCategory('all'); setResults([]); inputRef.current?.focus(); };
  const isPopular = query.trim().length === 0 && activeCategory === 'all';
  const isSearch = query.trim().length > 0;
  const industries = cacheRef.current?.industries || [];

  /* -- Render price -- */
  const renderPrice = (item: InstrumentItem) => {
    const source = getSource(item);
    if (item.category === 'index') {
      return (
        <div className='flex shrink-0 flex-col items-end gap-0.5 tabular-nums'>
          <span className='text-xs font-semibold text-[#111827]'>{formatIdx(item.pl)}</span>
          <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded', item.pcp > 0 ? 'bg-emerald-50 text-emerald-700' : item.pcp < 0 ? 'bg-red-50 text-red-700' : 'text-[#6b7280]')}>
            {item.pcp > 0 ? '+' : ''}{item.pcp?.toFixed(2)}%
          </span>
        </div>
      );
    }
    if (source === 'yahoo') {
      const cur = item.currency || item.unit || 'USD';
      if (item.pl === 0) return <div className='flex shrink-0 flex-col items-end gap-0.5'><span className='text-xs text-[#6b7280]'>—</span></div>;
      return (
        <div className='flex shrink-0 flex-col items-end gap-0.5 tabular-nums'>
          <div className='flex items-center gap-1'>
            <span className='text-xs font-semibold text-[#111827]'>{formatIdx(item.pl)}</span>
            <span className='text-[9px] text-[#9ca3af]'>{cur}</span>
          </div>
          <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded', item.pcp > 0 ? 'bg-emerald-50 text-emerald-700' : item.pcp < 0 ? 'bg-red-50 text-red-700' : 'text-[#6b7280]')}>
            {item.pcp > 0 ? '+' : ''}{item.pcp?.toFixed(2)}%
          </span>
        </div>
      );
    }
    if (source === 'tgju' && item.pl === 0) return <div className='flex shrink-0 flex-col items-end gap-0.5'><span className='text-xs text-[#6b7280]'>—</span></div>;
    const isUp = item.pcp > 0;
    return (
      <div className='flex shrink-0 flex-col items-end gap-0.5 tabular-nums'>
        <span className='text-xs font-semibold text-[#111827]'>{formatNum(item.pl)}</span>
        <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded', isUp ? 'bg-emerald-50 text-emerald-700' : !isUp && item.pcp < 0 ? 'bg-red-50 text-red-700' : 'text-[#6b7280]')}>
          {isUp ? '+' : ''}{item.pcp?.toFixed(2)}%
        </span>
      </div>
    );
  };

  /* -- Render item -- */
  const renderItem = (item: InstrumentItem, index: number) => {
    const isActive = index === activeIndex;
    const source = getSource(item);
    const flag = getCountryFlag(item.country) || getCountryFlag(item.countryEn);
    return (
      <div
        key={`${item.category}-${item.l18}-${item.tgjuKey || ''}-${item.yahooSymbol || ''}-${index}`}
        ref={(el) => { itemRefs.current[index] = el; }}
        role='option' aria-selected={isActive}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectSymbol(item)}
        className={cn(
          'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-all',
          'border-b border-[#e5e7eb]/50 last:border-b-0',
          isActive ? (source === 'yahoo' ? 'bg-indigo-50/80' : source === 'tgju' ? 'bg-teal-50/80' : 'bg-amber-50/80') : 'hover:bg-[#f8f9fa]',
        )}
      >
        <div className='flex min-w-0 flex-1 items-start gap-2.5'>
          <div className='flex shrink-0 items-center justify-center w-5 pt-0.5'>
            {item.pcp > 0 && <TrendingUp className='w-3.5 h-3.5 text-emerald-600' />}
            {item.pcp < 0 && <TrendingDown className='w-3.5 h-3.5 text-red-600' />}
            {item.pcp === 0 && <div className='w-2 h-2 rounded-full bg-gray-300' />}
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <div className='flex items-center gap-1.5 flex-wrap'>
              <span className='truncate font-bold text-[13px] text-[#111827]'>{item.l18}</span>
              <span className={cn('text-[9px] px-1.5 py-px rounded font-medium shrink-0', CATEGORY_COLORS[item.category] || 'bg-gray-50 text-gray-600')}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
              <span className={cn('text-[8px] px-1 py-px rounded font-medium shrink-0 border', SOURCE_STYLES[source])}>
                {source === 'tse' ? 'بورس' : source === 'tgju' ? 'TGJU' : 'Yahoo'}
              </span>
            </div>
            <div className='flex items-center gap-1.5 text-[11px] text-[#6b7280] leading-tight'>
              {flag && <span className='shrink-0'>{flag}</span>}
              {item.yahooSymbol && <span className='font-mono font-medium text-[#374151]'>{item.yahooSymbol}</span>}
              {item.nameEn && item.nameEn !== item.l18 && <span className='truncate'>{item.nameEn}</span>}
              {!item.nameEn && item.l30 && item.l30 !== item.l18 && <span className='truncate'>{item.l30}</span>}
              {item.exchange && <span className='shrink-0 text-[#9ca3af]'>{item.exchange}</span>}
              {item.cs && (item.category === 'stock' || source === 'yahoo') && <span className='truncate text-[#9ca3af]'>· {item.cs}</span>}
            </div>
            {item.category === 'stock' && item.cs && <span className='truncate text-[10px] text-[#9ca3af] leading-tight'>{item.cs}</span>}
          </div>
        </div>
        {renderPrice(item)}
      </div>
    );
  };

  return (
    <div dir='rtl' className={cn('relative', className)}>
      <div className='relative'>
        <Search className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280] pointer-events-none' />
        <Input ref={inputRef} type='text' value={query} onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus} onKeyDown={handleKeyDown} placeholder={placeholder} suppressHydrationWarning
          className={cn('h-11 w-full rounded-xl border border-[#e5e7eb] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] transition-all shadow-sm focus-visible:border-blue-400 focus-visible:ring-blue-400/20 focus-visible:ring-[3px] focus-visible:shadow-md pr-10', compact ? 'h-9 text-xs pr-9' : '')}
          autoComplete='off' spellCheck={false}
        />
        {query && <button onClick={clear} className='absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#111827] transition-colors' type='button'><X className='w-4 h-4' /></button>}
      </div>

      {open && (
        <div ref={dropdownRef}
          className='absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl shadow-gray-900/15 overflow-hidden'
          style={{ width: 'min(920px, 97vw)', maxHeight: 'min(80vh, 700px)', display: 'flex', flexDirection: 'column' }}
        >
          {/* ═══ Category tabs ═══ */}
          <div className='shrink-0 flex items-center gap-0.5 px-2 py-2 border-b border-[#e5e7eb] overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon; const isActive = activeCategory === cat.key;
              const src = YAHOO_SPECIFIC_CATEGORIES.has(cat.key) ? 'yahoo' : TGJU_CATEGORIES.has(cat.key) ? 'tgju' : 'tse';
              return (
                <button key={cat.key} onClick={() => handleCategoryChange(cat.key)} type='button'
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 border',
                    isActive ? (src === 'yahoo' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : src === 'tgju' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-amber-50 text-amber-800 border-amber-200') : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6] border-transparent',
                  )}
                >
                  <Icon className='w-3.5 h-3.5' />{cat.label}
                </button>
              );
            })}
          </div>

          {/* ═══ TSE Industry filter ═══ */}
          {activeCategory === 'stocks' && (
            <div className='shrink-0 relative px-3 py-2 border-b border-[#e5e7eb]'>
              <div className='flex items-center gap-2 overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
                <button onClick={() => handleIndustryChange(null)} type='button'
                  className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all shrink-0', !activeIndustry ? 'bg-blue-50 text-blue-700' : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]')}
                >
                  <Layers className='w-3 h-3' />همه صنایع
                </button>
                {industries.slice(0, 10).map((ind) => (
                  <button key={ind} onClick={() => handleIndustryChange(ind)} type='button'
                    className={cn('px-3 py-1 rounded-md text-[11px] whitespace-nowrap transition-all shrink-0', activeIndustry === ind ? 'bg-blue-50 text-blue-700 font-medium' : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]')}
                  >{ind}</button>
                ))}
                {industries.length > 10 && (
                  <div className='relative shrink-0'>
                    <button onClick={() => setShowIndustryPicker(!showIndustryPicker)} type='button'
                      className={cn('flex items-center gap-1 px-3 py-1 rounded-md text-[11px] transition-all', showIndustryPicker ? 'bg-blue-50 text-blue-700' : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]')}
                    >بیشتر<ChevronDown className={cn('w-3 h-3 transition-transform', showIndustryPicker && 'rotate-180')} /></button>
                    {showIndustryPicker && (
                      <div className='absolute top-full mt-1 left-0 right-0 z-10 rounded-lg border border-[#e5e7eb] bg-white shadow-xl p-2 max-h-[200px] overflow-y-auto' style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                        {industries.slice(10).map((ind) => (
                          <button key={ind} onClick={() => handleIndustryChange(ind)} type='button'
                            className={cn('block w-full text-right px-3 py-1.5 rounded-md text-[11px] transition-all', activeIndustry === ind ? 'bg-blue-50 text-blue-700 font-medium' : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]')}
                          >{ind}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {activeIndustry && (
                <div className='mt-1.5 flex items-center gap-1.5 text-[10px] text-blue-700'>
                  <span>صنعت:</span><span className='font-bold'>{activeIndustry}</span>
                  <button onClick={() => handleIndustryChange(null)} className='mr-1 hover:text-blue-600' type='button'><X className='w-3 h-3' /></button>
                </div>
              )}
            </div>
          )}

          {/* ═══ Yahoo Country + Sector filters (ALWAYS VISIBLE) ═══ */}
          {YAHOO_SPECIFIC_CATEGORIES.has(activeCategory) && (
            <div className='shrink-0 px-3 py-2 border-b border-[#e5e7eb] bg-[#fafbfc]'>
              {/* Country row — ALL countries as chips */}
              <div className='mb-1.5'>
                <div className='flex items-center gap-1.5 mb-1.5 text-[10px] font-medium text-[#6b7280]'>
                  <MapPin className='w-3 h-3' />کشور
                </div>
                <div className='flex flex-wrap gap-1.5'>
                  <button onClick={() => handleCountryChange(null)} type='button'
                    className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border shrink-0',
                      !activeCountry ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'text-[#6b7280] hover:text-[#111827] hover:bg-white border-transparent',
                    )}
                  >همه</button>
                  {yahooCountries.map((c) => (
                    <button key={c} onClick={() => handleCountryChange(activeCountry === c ? null : c)} type='button'
                      className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border shrink-0',
                        activeCountry === c ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'text-[#6b7280] hover:text-[#111827] hover:bg-white border-transparent',
                      )}
                    >
                      <span className='text-sm leading-none'>{getCountryFlag(c)}</span>{c}
                    </button>
                  ))}
                </div>
              </div>
              {/* Sector row (only for yahoo_stock) */}
              {activeCategory === 'yahoo_stock' && yahooSectors.length > 0 && (
                <div>
                  <div className='flex items-center gap-1.5 mb-1.5 text-[10px] font-medium text-[#6b7280]'>
                    <Zap className='w-3 h-3' />صنعت (Sector)
                  </div>
                  <div className='flex flex-wrap gap-1.5'>
                    <button onClick={() => handleSectorChange(null)} type='button'
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border shrink-0',
                        !activeSector ? 'bg-purple-100 text-purple-800 border-purple-300' : 'text-[#6b7280] hover:text-[#111827] hover:bg-white border-transparent',
                      )}
                    >همه</button>
                    {yahooSectors.slice(0, 8).map((s) => (
                      <button key={s} onClick={() => handleSectorChange(activeSector === s ? null : s)} type='button'
                        className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border shrink-0',
                          activeSector === s ? 'bg-purple-100 text-purple-800 border-purple-300' : 'text-[#6b7280] hover:text-[#111827] hover:bg-white border-transparent',
                        )}
                      >{s}</button>
                    ))}
                    {yahooSectors.length > 8 && (
                      <div className='relative shrink-0'>
                        <button onClick={() => setShowSectorPicker(!showSectorPicker)} type='button'
                          className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border shrink-0',
                            showSectorPicker ? 'bg-purple-100 text-purple-800 border-purple-300' : 'text-[#6b7280] hover:text-[#111827] hover:bg-white border-transparent',
                          )}
                        >بیشتر<ChevronDown className={cn('w-3 h-3 transition-transform', showSectorPicker && 'rotate-180')} /></button>
                        {showSectorPicker && (
                          <div className='absolute top-full mt-1 left-0 z-10 rounded-lg border border-[#e5e7eb] bg-white shadow-xl p-2 min-w-[180px] max-h-[200px] overflow-y-auto' style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                            {yahooSectors.slice(8).map((s) => (
                              <button key={s} onClick={() => handleSectorChange(s)} type='button'
                                className={cn('block w-full text-right px-3 py-1.5 rounded-md text-[11px] transition-all',
                                  activeSector === s ? 'bg-purple-50 text-purple-700 font-medium' : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]',
                                )}
                              >{s}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Search hint ═══ */}
          {isSearch && (
            <div className='shrink-0 px-4 py-1.5 border-b border-[#f3f4f6] bg-[#f9fafb]'>
              <span className='flex items-center gap-1 text-[10px] text-[#9ca3af]'><Hash className='w-3 h-3' />جستجو در نام فارسی، انگلیسی، نماد، کشور، صرافی و صنعت</span>
            </div>
          )}

          {/* ═══ Content area (fills remaining space) ═══ */}
          <div className='flex-1 overflow-hidden flex flex-col min-h-0'>
            {/* Loading */}
            {loading && results.length === 0 && (
              <div className='flex-1 flex items-center justify-center gap-2 text-sm text-[#6b7280]'><Spinner /><span>در حال بارگذاری ...</span></div>
            )}

            {/* Empty */}
            {!loading && results.length === 0 && query.trim().length > 0 && (
              <div className='flex-1 flex flex-col items-center justify-center py-10'>
                <div className='text-[#6b7280] text-sm mb-1'>ابزاری با این نام یافت نشد</div>
                <div className='text-[#9ca3af] text-xs'>نام فارسی، نام انگلیسی، نماد (مثلاً AAPL)، کشور یا صنعت را جستجو کنید</div>
              </div>
            )}

            {/* Recent searches */}
            {!loading && results.length === 0 && query.trim().length === 0 && activeCategory === 'all' && recentSearches.length > 0 && (
              <div className='px-4 py-3'>
                <div className='flex items-center gap-1.5 text-[11px] text-[#9ca3af] mb-2'><Clock className='w-3 h-3' />جستجوهای اخیر</div>
                <div className='flex flex-wrap gap-1.5'>{recentSearches.map((r) => (
                  <button key={r} onClick={() => { setQuery(r); handleChange(r); }} type='button'
                    className='px-2.5 py-1 rounded-lg text-[11px] text-[#374151] bg-[#f3f4f6] hover:bg-[#e5e7eb] transition-colors'
                  >{r}</button>
                ))}</div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <>
                <div className='shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#e5e7eb]'>
                  <span className='text-xs text-[#6b7280]'>
                    {isPopular && <><Star className='w-3 h-3 inline-block ml-1 text-amber-500' />محبوب‌ترین‌ها</>}
                    {!isPopular && !isSearch && activeCategory !== 'all' && (
                      <>
                        {activeIndustry && <span className='ml-1'>{activeIndustry} ·</span>}
                        {activeCountry && <><span className='ml-1'>{getCountryFlag(activeCountry)} {activeCountry} ·</span></>}
                        {activeSector && <span className='ml-1'>{activeSector} ·</span>}
                        {CATEGORIES.find(c => c.key === activeCategory)?.label || ''}
                      </>
                    )}
                    {isSearch && <>{totalMatched.toLocaleString('fa-IR')} نتیجه</>}
                  </span>
                  {isSearch && <span className='text-[10px] text-[#9ca3af]'>↑↓ ناوبری · Enter انتخاب · Esc بستن</span>}
                </div>

                <div role='listbox' className='flex-1 overflow-y-auto min-h-0' style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                  {results.map((item, index) => renderItem(item, index))}
                </div>

                {!isPopular && totalMatched > MAX_RESULTS && (
                  <div className='shrink-0 px-4 py-2 border-t border-[#e5e7eb] text-center text-[11px] text-[#9ca3af]'>
                    و {((totalMatched - MAX_RESULTS).toLocaleString('fa-IR'))} مورد دیگر ... عبارت دقیق‌تری وارد کنید
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
