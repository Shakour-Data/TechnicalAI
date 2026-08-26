'use client';

import { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Database, Workflow, Boxes, Server, Layers,
  ChevronLeft, ArrowLeftRight, FileCode, Cpu,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-store';

const sections = [
  { id: 'architecture', label: 'نمای کلی معماری سیستم', icon: Boxes },
  { id: 'bpmn', label: 'نمودار فرآیند BPMN', icon: Workflow },
  { id: 'uml', label: 'نمودار کلاس UML', icon: FileCode },
  { id: 'components', label: 'معماری کامپوننت‌ها', icon: Layers },
  { id: 'dataflow', label: 'جریان داده', icon: ArrowLeftRight },
  { id: 'stack', label: 'پشته فناوری', icon: Database },
] as const;

export default function DocsPage() {
  const { colors: C } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState('architecture');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { root: el, threshold: 0.3, rootMargin: '-60px 0px -40% 0px' },
    );
    sections.forEach((s) => { const t = el.querySelector(`#${s.id}`); if (t) obs.observe(t); });
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = containerRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Common SVG diagram styles derived from theme
  const svgBg = C.pageBg;
  const svgPrimary = C.primary;
  const svgPrimaryFill = C.primary;
  const svgLabel = C.cardSubFg;
  const svgText = C.primary;

  return (
    <div className="flex gap-6 max-h-[calc(100vh-140px)] overflow-hidden" dir="rtl">
      {/* Sidebar TOC */}
      <nav className="w-64 shrink-0 overflow-y-auto rounded-xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: C.primary }}>
          <BookOpen className="w-4 h-4" /> فهرست مطالب
        </h2>
        <ul className="space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.id}>
                <button
                  onClick={() => scrollTo(s.id)}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    backgroundColor: active === s.id ? C.primaryBg : 'transparent',
                    color: active === s.id ? C.primary : C.cardSubFg,
                    fontWeight: active === s.id ? 600 : 400,
                  }}
                >
                  <ChevronLeft className={`w-3 h-3 transition-transform ${active === s.id ? '' : 'opacity-0'}`} style={{ color: C.accent }} />
                  <Icon className="w-4 h-4" />
                  <span>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Main content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-6 pl-2">
        {/* 1. DFD */}
        <section id="architecture">
          <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
            <CardHeader><CardTitle className="flex items-center gap-2" style={{ color: C.primary }}><Boxes className="w-5 h-5" /> نمای کلی معماری سیستم (DFD)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>نمودار جریان داده سطح صفر — نمایش تعامل بین کاربر، سرور و پایگاه داده.</p>
              <svg viewBox="0 0 600 280" className="w-full rounded-lg p-2" style={{ backgroundColor: svgBg }} dir="ltr">
                {/* User */}
                <rect x="20" y="100" width="120" height="50" rx="8" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="80" y="130" textAnchor="middle" fill={svgText} fontSize="13" fontWeight="600">User / کاربر</text>
                {/* Frontend */}
                <rect x="220" y="40" width="140" height="50" rx="8" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="290" y="70" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="600">Frontend (Next.js)</text>
                {/* API */}
                <rect x="220" y="140" width="140" height="50" rx="8" fill={svgPrimary} fillOpacity="0.2" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="290" y="170" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="600">API Server</text>
                {/* Database */}
                <rect x="440" y="90" width="130" height="50" rx="8" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="505" y="120" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="600">Database</text>
                {/* Auth Service */}
                <rect x="440" y="180" width="130" height="50" rx="8" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="505" y="210" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="600">Auth Service</text>
                {/* Arrows */}
                <defs><marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill={svgPrimary} /></marker></defs>
                <line x1="140" y1="115" x2="218" y2="75" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr)" />
                <text x="175" y="85" fill={svgLabel} fontSize="9">درخواست</text>
                <line x1="218" y1="75" x2="145" y2="130" stroke={svgPrimary} strokeWidth="1.2" strokeDasharray="4" markerEnd="url(#arr)" />
                <text x="170" y="118" fill={svgLabel} fontSize="9">پاسخ</text>
                <line x1="290" y1="90" x2="290" y2="138" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr)" />
                <text x="296" y="118" fill={svgLabel} fontSize="9">API Call</text>
                <line x1="360" y1="160" x2="438" y2="120" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr)" />
                <text x="395" y="132" fill={svgLabel} fontSize="9">Query</text>
                <line x1="360" y1="175" x2="438" y2="200" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr)" />
                <text x="390" y="196" fill={svgLabel} fontSize="9">Verify</text>
              </svg>
            </CardContent>
          </Card>
        </section>

        {/* 2. BPMN */}
        <section id="bpmn">
          <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
            <CardHeader><CardTitle className="flex items-center gap-2" style={{ color: C.primary }}><Workflow className="w-5 h-5" /> نمودار فرآیند کسب‌وکار (BPMN)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>فرآیند ثبت‌نام و ورود کاربر — از شروع تا پایان.</p>
              <svg viewBox="0 0 700 180" className="w-full rounded-lg p-2" style={{ backgroundColor: svgBg }} dir="ltr">
                <defs><marker id="arr2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill={svgPrimary} /></marker></defs>
                {/* Start */}
                <circle cx="30" cy="90" r="16" fill="#22c55e" fillOpacity="0.3" stroke="#22c55e" strokeWidth="1.5" />
                <text x="30" y="94" textAnchor="middle" fill="#4ade80" fontSize="9" fontWeight="700">شروع</text>
                {/* Task 1 */}
                <rect x="70" y="65" width="100" height="50" rx="6" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="120" y="94" textAnchor="middle" fill={svgText} fontSize="11">ورود اطلاعات</text>
                {/* Gateway */}
                <polygon points="230,60 260,90 230,120 200,90" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1.5" />
                <text x="230" y="94" textAnchor="middle" fill="#60a5fa" fontSize="18">×</text>
                {/* Valid path */}
                <rect x="290" y="65" width="100" height="50" rx="6" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="340" y="94" textAnchor="middle" fill={svgText} fontSize="11">اعتبارسنجی</text>
                {/* Task 3 */}
                <rect x="430" y="65" width="100" height="50" rx="6" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="480" y="94" textAnchor="middle" fill={svgText} fontSize="11">ذخیره داده</text>
                {/* End */}
                <circle cx="600" cy="90" r="16" fill="#ef4444" fillOpacity="0.3" stroke="#ef4444" strokeWidth="3" />
                <text x="600" y="94" textAnchor="middle" fill="#f87171" fontSize="9" fontWeight="700">پایان</text>
                {/* Error box */}
                <rect x="200" y="140" width="80" height="36" rx="6" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1" />
                <text x="240" y="162" textAnchor="middle" fill="#f87171" fontSize="10">خطا</text>
                {/* Arrows */}
                <line x1="46" y1="90" x2="68" y2="90" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr2)" />
                <line x1="170" y1="90" x2="198" y2="90" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr2)" />
                <line x1="262" y1="90" x2="288" y2="90" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr2)" />
                <text x="272" y="84" fill="#4ade80" fontSize="9">بله</text>
                <line x1="390" y1="90" x2="428" y2="90" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr2)" />
                <line x1="530" y1="90" x2="582" y2="90" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr2)" />
                <line x1="230" y1="120" x2="235" y2="138" stroke="#ef4444" strokeWidth="1" strokeDasharray="3" markerEnd="url(#arr2)" />
                <text x="244" y="134" fill="#f87171" fontSize="9">خیر</text>
                <line x1="280" y1="158" x2="145" y2="100" stroke="#ef4444" strokeWidth="1" strokeDasharray="3" markerEnd="url(#arr2)" />
              </svg>
            </CardContent>
          </Card>
        </section>

        {/* 3. UML Class Diagram */}
        <section id="uml">
          <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
            <CardHeader><CardTitle className="flex items-center gap-2" style={{ color: C.primary }}><FileCode className="w-5 h-5" /> نمودار کلاس UML</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>نمایش ساختار کلاس‌های اصلی سیستم و روابط بین آن‌ها.</p>
              <svg viewBox="0 0 680 260" className="w-full rounded-lg p-2" style={{ backgroundColor: svgBg }} dir="ltr">
                <defs><marker id="arr3" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill={svgPrimary} /></marker></defs>
                {/* User class */}
                <rect x="20" y="30" width="160" height="90" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1.5" />
                <rect x="20" y="30" width="160" height="28" rx="4" fill={svgPrimary} fillOpacity="0.25" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="100" y="49" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="700">User</text>
                <text x="30" y="78" fill={svgLabel} fontSize="10">- id: string</text>
                <text x="30" y="93" fill={svgLabel} fontSize="10">- email: string</text>
                <text x="30" y="108" fill={svgLabel} fontSize="10">+ login(): Promise</text>
                {/* AuthService class */}
                <rect x="260" y="30" width="160" height="90" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1.5" />
                <rect x="260" y="30" width="160" height="28" rx="4" fill={svgPrimary} fillOpacity="0.25" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="340" y="49" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="700">AuthService</text>
                <text x="270" y="78" fill={svgLabel} fontSize="10">- token: string</text>
                <text x="270" y="93" fill={svgLabel} fontSize="10">+ verify(): boolean</text>
                <text x="270" y="108" fill={svgLabel} fontSize="10">+ refresh(): Token</text>
                {/* DataStore class */}
                <rect x="500" y="30" width="160" height="90" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1.5" />
                <rect x="500" y="30" width="160" height="28" rx="4" fill={svgPrimary} fillOpacity="0.25" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="580" y="49" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="700">DataStore</text>
                <text x="510" y="78" fill={svgLabel} fontSize="10">- connection: Pool</text>
                <text x="510" y="93" fill={svgLabel} fontSize="10">+ query(): Result</text>
                <text x="510" y="108" fill={svgLabel} fontSize="10">+ migrate(): void</text>
                {/* ApiController class */}
                <rect x="140" y="160" width="160" height="80" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1.5" />
                <rect x="140" y="160" width="160" height="28" rx="4" fill={svgPrimary} fillOpacity="0.25" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="220" y="179" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="700">ApiController</text>
                <text x="150" y="208" fill={svgLabel} fontSize="10">+ handleRequest(): Resp</text>
                <text x="150" y="223" fill={svgLabel} fontSize="10">+ validate(): boolean</text>
                {/* Relations */}
                <line x1="180" y1="120" x2="210" y2="158" stroke={svgPrimary} strokeWidth="1" strokeDasharray="5" />
                <text x="180" y="143" fill={svgLabel} fontSize="9">uses</text>
                <line x1="420" y1="75" x2="498" y2="75" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr3)" />
                <text x="450" y="68" fill={svgLabel} fontSize="9">depends</text>
                <line x1="260" y1="75" x2="182" y2="75" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr3)" />
                <text x="210" y="68" fill={svgLabel} fontSize="9">auth</text>
              </svg>
            </CardContent>
          </Card>
        </section>

        {/* 4. Component Architecture */}
        <section id="components">
          <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
            <CardHeader><CardTitle className="flex items-center gap-2" style={{ color: C.primary }}><Layers className="w-5 h-5" /> معماری کامپوننت‌های React</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>ساختار درختی کامپوننت‌های اصلی اپلیکیشن.</p>
              <svg viewBox="0 0 600 220" className="w-full rounded-lg p-2" style={{ backgroundColor: svgBg }} dir="ltr">
                <defs><marker id="arr4" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill={svgPrimary} /></marker></defs>
                {/* App root */}
                <rect x="230" y="10" width="140" height="36" rx="6" fill={svgPrimary} fillOpacity="0.25" stroke={svgPrimary} strokeWidth="2" />
                <text x="300" y="33" textAnchor="middle" fill={svgText} fontSize="12" fontWeight="700">App (Root)</text>
                {/* Layout */}
                <rect x="230" y="70" width="140" height="36" rx="6" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="300" y="93" textAnchor="middle" fill={svgText} fontSize="11">Layout</text>
                <line x1="300" y1="46" x2="300" y2="68" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
                {/* Sidebar + Main */}
                <rect x="80" y="130" width="120" height="36" rx="6" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="140" y="153" textAnchor="middle" fill={svgText} fontSize="11">Sidebar</text>
                <rect x="400" y="130" width="120" height="36" rx="6" fill={svgPrimary} fillOpacity="0.15" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="460" y="153" textAnchor="middle" fill={svgText} fontSize="11">MainContent</text>
                <line x1="270" y1="106" x2="160" y2="128" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
                <line x1="330" y1="106" x2="440" y2="128" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
                {/* Children */}
                <rect x="40" y="185" width="100" height="30" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1" />
                <text x="90" y="204" textAnchor="middle" fill={svgLabel} fontSize="10">NavMenu</text>
                <rect x="155" y="185" width="100" height="30" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1" />
                <text x="205" y="204" textAnchor="middle" fill={svgLabel} fontSize="10">UserPanel</text>
                <rect x="350" y="185" width="100" height="30" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1" />
                <text x="400" y="204" textAnchor="middle" fill={svgLabel} fontSize="10">Dashboard</text>
                <rect x="465" y="185" width="100" height="30" rx="4" fill={svgPrimary} fillOpacity="0.1" stroke={svgPrimary} strokeWidth="1" />
                <text x="515" y="204" textAnchor="middle" fill={svgLabel} fontSize="10">DocsPage</text>
                <line x1="120" y1="166" x2="100" y2="183" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
                <line x1="160" y1="166" x2="195" y2="183" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
                <line x1="440" y1="166" x2="410" y2="183" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
                <line x1="480" y1="166" x2="505" y2="183" stroke={svgPrimary} strokeWidth="1" markerEnd="url(#arr4)" />
              </svg>
            </CardContent>
          </Card>
        </section>

        {/* 5. Data Flow */}
        <section id="dataflow">
          <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
            <CardHeader><CardTitle className="flex items-center gap-2" style={{ color: C.primary }}><ArrowLeftRight className="w-5 h-5" /> جریان داده</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>مسیر جریان داده‌ها از مرورگر تا پایگاه داده و برعکس.</p>
              <svg viewBox="0 0 700 120" className="w-full rounded-lg p-2" style={{ backgroundColor: svgBg }} dir="ltr">
                <defs><marker id="arr5" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill={svgPrimary} /></marker></defs>
                {/* Boxes */}
                <rect x="10" y="30" width="100" height="40" rx="6" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1.5" />
                <text x="60" y="55" textAnchor="middle" fill="#60a5fa" fontSize="11">Browser</text>
                <rect x="160" y="30" width="100" height="40" rx="6" fill={svgPrimary} fillOpacity="0.2" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="210" y="55" textAnchor="middle" fill={svgText} fontSize="11">Next.js SSR</text>
                <rect x="310" y="30" width="100" height="40" rx="6" fill={svgPrimary} fillOpacity="0.2" stroke={svgPrimary} strokeWidth="1.5" />
                <text x="360" y="55" textAnchor="middle" fill={svgText} fontSize="11">API Route</text>
                <rect x="460" y="30" width="100" height="40" rx="6" fill="#8b5cf6" fillOpacity="0.2" stroke="#8b5cf6" strokeWidth="1.5" />
                <text x="510" y="55" textAnchor="middle" fill="#a78bfa" fontSize="11">Prisma ORM</text>
                <rect x="600" y="30" width="80" height="40" rx="6" fill="#22c55e" fillOpacity="0.2" stroke="#22c55e" strokeWidth="1.5" />
                <text x="640" y="55" textAnchor="middle" fill="#4ade80" fontSize="11">SQLite</text>
                {/* Forward arrows */}
                <line x1="112" y1="42" x2="158" y2="42" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr5)" />
                <line x1="262" y1="42" x2="308" y2="42" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr5)" />
                <line x1="412" y1="42" x2="458" y2="42" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr5)" />
                <line x1="562" y1="42" x2="598" y2="42" stroke={svgPrimary} strokeWidth="1.2" markerEnd="url(#arr5)" />
                {/* Return arrows */}
                <line x1="158" y1="60" x2="112" y2="60" stroke={svgPrimary} strokeWidth="1" strokeDasharray="4" markerEnd="url(#arr5)" />
                <line x1="308" y1="60" x2="262" y2="60" stroke={svgPrimary} strokeWidth="1" strokeDasharray="4" markerEnd="url(#arr5)" />
                <line x1="458" y1="60" x2="412" y2="60" stroke={svgPrimary} strokeWidth="1" strokeDasharray="4" markerEnd="url(#arr5)" />
                <line x1="598" y1="60" x2="562" y2="60" stroke={svgPrimary} strokeWidth="1" strokeDasharray="4" markerEnd="url(#arr5)" />
                {/* Labels */}
                <text x="135" y="36" fill={svgLabel} fontSize="8">HTTP</text>
                <text x="285" y="36" fill={svgLabel} fontSize="8">fetch</text>
                <text x="435" y="36" fill={svgLabel} fontSize="8">SQL</text>
                <text x="580" y="36" fill={svgLabel} fontSize="8">TCP</text>
                {/* Legend */}
                <line x1="20" y1="95" x2="50" y2="95" stroke={svgPrimary} strokeWidth="1.2" />
                <text x="55" y="99" fill={svgLabel} fontSize="9">درخواست</text>
                <line x1="140" y1="95" x2="170" y2="95" stroke={svgPrimary} strokeWidth="1" strokeDasharray="4" />
                <text x="175" y="99" fill={svgLabel} fontSize="9">پاسخ</text>
              </svg>
            </CardContent>
          </Card>
        </section>

        {/* 6. Technology Stack */}
        <section id="stack">
          <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
            <CardHeader><CardTitle className="flex items-center gap-2" style={{ color: C.primary }}><Database className="w-5 h-5" /> پشته فناوری</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>فناوری‌های مورد استفاده در پروژه.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: 'فرانت‌اند', icon: <Server className="w-5 h-5" />, items: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS 4'] },
                  { title: 'بک‌اند', icon: <Cpu className="w-5 h-5" />, items: ['API Routes', 'Prisma ORM', 'NextAuth.js', 'Zod Validation'] },
                  { title: 'زیرساخت', icon: <Database className="w-5 h-5" />, items: ['SQLite', 'Bun Runtime', 'Docker', 'Vercel Deploy'] },
                ].map((group) => (
                  <div key={group.title} className="rounded-xl p-4" style={{ backgroundColor: C.primaryBg, border: `1px solid ${C.cardBorder}` }}>
                    <div className="flex items-center gap-2 font-semibold mb-3" style={{ color: C.primary }}>
                      {group.icon}<span>{group.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <Badge key={item} variant="outline" className="text-xs" style={{ borderColor: C.cardBorder, color: C.cardFg, backgroundColor: C.primaryBg }}>
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
