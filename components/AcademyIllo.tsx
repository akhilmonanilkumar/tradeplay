/* Hand-drawn SVG diagrams for Academy lessons. Colors follow the theme tokens. */

const UP = "rgb(var(--up))";
const DOWN = "rgb(var(--down))";
const INK = "rgb(var(--ink))";
const MUTE = "rgb(var(--mute))";
const LINE = "rgb(var(--line))";
const CHART = "rgb(var(--chart))";
const ACCENT = "rgb(var(--accent))";

type C = { x: number; o: number; c: number; h: number; l: number };

/** Candles on a 0–100 price scale mapped into the 180px-high viewBox (higher price = higher on screen). */
function Candles({ data, w = 10, y = (p: number) => 165 - p * 1.5 }: { data: C[]; w?: number; y?: (p: number) => number }) {
  return (
    <g>
      {data.map((k, i) => {
        const up = k.c >= k.o;
        const col = up ? UP : DOWN;
        const top = y(Math.max(k.o, k.c));
        const bot = y(Math.min(k.o, k.c));
        return (
          <g key={i}>
            <line x1={k.x} x2={k.x} y1={y(k.h)} y2={y(k.l)} stroke={col} strokeWidth={1.5} />
            <rect x={k.x - w / 2} y={top} width={w} height={Math.max(1.5, bot - top)} rx={1.5} fill={col} />
          </g>
        );
      })}
    </g>
  );
}

const T = ({ x, y, children, c = MUTE, a = "middle", s = 10, b }: { x: number; y: number; children: React.ReactNode; c?: string; a?: "start" | "middle" | "end"; s?: number; b?: boolean }) => (
  <text x={x} y={y} fill={c} fontSize={s} textAnchor={a} fontWeight={b ? 600 : 400} fontFamily="var(--font-geist-sans), system-ui, sans-serif">{children}</text>
);
const Zone = ({ y1, y2, x1 = 20, x2 = 300, c, label }: { y1: number; y2: number; x1?: number; x2?: number; c: string; label?: string }) => (
  <g>
    <rect x={x1} y={Math.min(y1, y2)} width={x2 - x1} height={Math.abs(y2 - y1)} fill={c} opacity={0.16} rx={3} />
    <rect x={x1} y={Math.min(y1, y2)} width={x2 - x1} height={Math.abs(y2 - y1)} fill="none" stroke={c} strokeOpacity={0.5} strokeDasharray="4 3" rx={3} />
    {label && <T x={x2 - 4} y={Math.min(y1, y2) + 11} a="end" c={c} s={9} b>{label}</T>}
  </g>
);
const Path = ({ d, c = INK, w = 2, dash }: { d: string; c?: string; w?: number; dash?: string }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />;
const Dot = ({ x, y, c = INK, r = 3 }: { x: number; y: number; c?: string; r?: number }) => <circle cx={x} cy={y} r={r} fill={c} />;
const HLine = ({ y, x1 = 20, x2 = 300, c = MUTE, dash = "4 4", label, la = "end" }: { y: number; x1?: number; x2?: number; c?: string; dash?: string; label?: string; la?: "start" | "end" }) => (
  <g>
    <line x1={x1} x2={x2} y1={y} y2={y} stroke={c} strokeDasharray={dash} />
    {label && <T x={la === "end" ? x2 : x1} y={y - 4} a={la} c={c} s={9}>{label}</T>}
  </g>
);

const ILLOS: Record<string, () => React.ReactElement> = {
  candles: () => (
    <g>
      <Candles data={[{ x: 90, o: 40, c: 75, h: 85, l: 30 }, { x: 220, o: 75, c: 40, h: 85, l: 30 }]} w={28} />
      <T x={90} y={175} b c={UP}>Bullish candle</T>
      <T x={220} y={175} b c={DOWN}>Bearish candle</T>
      <HLine y={165 - 85 * 1.5} x1={110} x2={150} label="High" la="start" />
      <HLine y={165 - 75 * 1.5} x1={110} x2={150} label="Close" la="start" />
      <HLine y={165 - 40 * 1.5} x1={110} x2={150} label="Open" la="start" />
      <HLine y={165 - 30 * 1.5} x1={110} x2={150} label="Low" la="start" />
      <T x={260} y={40} a="start" s={9}>Wick</T>
      <T x={260} y={90} a="start" s={9}>Body</T>
    </g>
  ),
  structure: () => (
    <g>
      <Path d="M20 150 L70 100 L100 125 L150 70 L180 95 L230 40 L260 70 L300 90" c={INK} />
      <HLine y={70} x1={150} x2={300} c={DOWN} label="" />
      {[["HL", 100, 140], ["HH", 150, 62], ["HL", 180, 110], ["HH", 230, 32]].map(([t, x, y]) => <T key={`${t}${x}`} x={Number(x)} y={Number(y)} b c={String(t).startsWith("HH") ? UP : CHART}>{t}</T>)}
      <T x={286} y={82} c={DOWN} b s={9}>break</T>
      <T x={20} y={20} a="start" s={10} b c={INK}>Uptrend: higher highs + higher lows</T>
      <Dot x={280} y={80} c={DOWN} />
    </g>
  ),
  liquidity: () => (
    <g>
      <Path d="M20 120 L60 60 L90 95 L130 60 L160 100 L200 120 L230 115 L260 140 L290 110" />
      <HLine y={60} x1={50} x2={300} c={DOWN} label="Equal highs — buy stops (buy-side liquidity)" />
      <HLine y={140} x1={180} x2={300} c={UP} label="Swing low — sell stops (sell-side liquidity)" />
      {[70, 100, 140, 170, 200, 230].map((x) => <T key={x} x={x} y={52} c={DOWN} s={9}>$</T>)}
      {[210, 240, 270].map((x) => <T key={x} x={x} y={156} c={UP} s={9}>$</T>)}
    </g>
  ),
  sweep: () => (
    <g>
      <Path d="M20 110 L60 60 L90 95 L130 60 L160 95 L190 80 L205 45 L215 85 L250 130 L300 150" />
      <HLine y={60} x1={40} x2={300} c={MUTE} label="Equal highs" />
      <Dot x={205} y={45} c={DOWN} r={4} />
      <T x={205} y={34} c={DOWN} b>Sweep</T>
      <T x={250} y={115} a="start" c={INK} s={9}>…then the real move</T>
      <T x={95} y={125} c={CHART} s={9}>Inducement: “double top, sell!”</T>
    </g>
  ),
  supplydemand: () => (
    <g>
      <Zone y1={120} y2={140} x1={40} x2={300} c={UP} label="Demand" />
      <Candles data={[{ x: 50, o: 25, c: 22, h: 28, l: 18 }, { x: 64, o: 22, c: 26, h: 29, l: 17 }, { x: 78, o: 26, c: 55, h: 58, l: 24 }, { x: 92, o: 55, c: 80, h: 83, l: 53 }]} w={10} />
      <Path d="M100 40 L150 55 L180 85 L205 125 L230 85 L280 40" c={INK} />
      <T x={70} y={175} s={9}>Base (balance)</T>
      <T x={120} y={30} s={9} c={UP} b>Strong move away (imbalance)</T>
      <Dot x={205} y={125} c={UP} r={4} />
      <T x={230} y={150} s={9} c={INK}>Return = entry area</T>
    </g>
  ),
  premiumdiscount: () => (
    <g>
      <rect x={60} y={30} width={180} height={60} fill={DOWN} opacity={0.12} />
      <rect x={60} y={90} width={180} height={60} fill={UP} opacity={0.12} />
      <HLine y={30} x1={60} x2={240} c={INK} dash="0" label="Swing high" />
      <HLine y={150} x1={60} x2={240} c={INK} dash="0" label="Swing low" />
      <HLine y={90} x1={60} x2={240} c={ACCENT} label="50% equilibrium" />
      <T x={150} y={65} c={DOWN} b>PREMIUM — sell zone</T>
      <T x={150} y={125} c={UP} b>DISCOUNT — buy zone</T>
      <Path d="M20 150 L60 150 L100 60 L130 40 L160 30" c={MUTE} w={1.5} dash="3 3" />
      <T x={280} y={86} c={MUTE} s={9}>Mid =</T><T x={280} y={98} c={MUTE} s={9}>no trade</T>
    </g>
  ),
  fvg: () => (
    <g>
      <Candles data={[{ x: 110, o: 30, c: 40, h: 45, l: 27 }, { x: 150, o: 42, c: 85, h: 88, l: 40 }, { x: 190, o: 84, c: 92, h: 98, l: 70 }]} w={22} />
      <rect x={95} y={165 - 70 * 1.5} width={115} height={(70 - 45) * 1.5} fill={CHART} opacity={0.22} />
      <T x={250} y={165 - 58 * 1.5} a="start" c={CHART} b s={10}>FVG</T>
      <T x={250} y={165 - 52 * 1.5} a="start" c={MUTE} s={9}>gap between</T>
      <T x={250} y={165 - 46 * 1.5} a="start" c={MUTE} s={9}>wick 1 &amp; wick 3</T>
      <T x={110} y={175} s={9}>1</T>
      <T x={150} y={175} s={9}>2</T>
      <T x={190} y={175} s={9}>3</T>
    </g>
  ),
  orderblock: () => (
    <g>
      <Candles data={[{ x: 60, o: 50, c: 44, h: 52, l: 40 }, { x: 80, o: 44, c: 38, h: 46, l: 34 }, { x: 100, o: 38, c: 33, h: 40, l: 28 }, { x: 120, o: 33, c: 62, h: 64, l: 31 }, { x: 140, o: 62, c: 82, h: 86, l: 60 }]} w={12} />
      <Zone y1={165 - 40 * 1.5} y2={165 - 28 * 1.5} x1={93} x2={300} c={UP} label="Order block" />
      <rect x={113} y={165 - 60 * 1.5} width={34} height={(60 - 40) * 1.5} fill={CHART} opacity={0.2} />
      <T x={175} y={60} c={CHART} s={9}>imbalance (FVG)</T>
      <Path d="M150 30 L200 60 L240 112" c={INK} />
      <Dot x={240} y={112} c={UP} r={4} />
      <T x={100} y={175} s={9}>last down candle</T>
    </g>
  ),
  flipzone: () => (
    <g>
      <Path d="M20 140 L60 80 L90 110 L130 50 L160 95 L185 70 L205 120 L240 85 L290 150" />
      <Zone y1={70} y2={95} x1={160} x2={300} c={DOWN} label="Supply flip zone" />
      <HLine y={95} x1={20} x2={150} c={MUTE} label="" />
      <T x={95} y={124} c={MUTE} s={9}>demand held… then failed</T>
      <T x={185} y={62} c={DOWN} s={9} b>failed reaction</T>
      <Dot x={205} y={120} c={DOWN} />
      <T x={205} y={135} s={9} c={INK}>shift</T>
      <Dot x={240} y={85} c={DOWN} r={4} />
    </g>
  ),
  cycle: () => (
    <g>
      <Path d="M20 150 L70 60" c={UP} w={3} />
      <Path d="M70 60 L105 100" c={DOWN} w={3} />
      <Path d="M105 100 L120 88 L135 102 L150 90 L165 100" c={MUTE} w={3} />
      <Path d="M165 100 L215 30" c={UP} w={3} />
      <Path d="M165 100 L215 160" c={DOWN} w={2} dash="4 4" />
      <T x={40} y={95} c={UP} b s={9}>Expansion</T>
      <T x={95} y={70} c={DOWN} b s={9}>Pullback</T>
      <T x={140} y={125} c={MUTE} b s={9}>Consolidation</T>
      <T x={245} y={40} c={UP} b s={9}>Continuation</T>
      <T x={245} y={160} c={DOWN} b s={9}>…or reversal</T>
    </g>
  ),
  sessions: () => (
    <g>
      {[["Asia", 20, 100, "#14B8A6"], ["London", 120, 80, "#8B5CF6"], ["New York", 210, 80, "#F2C14E"]].map(([n, x, w, c]) => (
        <g key={String(n)}>
          <rect x={Number(x)} y={70} width={Number(w)} height={40} rx={8} fill={String(c)} opacity={0.25} />
          <T x={Number(x) + Number(w) / 2} y={94} c={INK} b>{n}</T>
        </g>
      ))}
      <T x={160} y={40} c={INK} b s={11}>Trade the Q-zones, not the whole day</T>
      <T x={70} y={130} s={9}>ranges, builds liquidity</T>
      <T x={160} y={130} s={9}>sweeps + expansion</T>
      <T x={250} y={130} s={9}>news, continuation/reversal</T>
    </g>
  ),
  mtf: () => (
    <g>
      {[["4H / 1H", "Bias & range", 20], ["15M", "Points of interest", 120], ["5M / 1M", "Entry trigger", 220]].map(([tf, what, x], i) => (
        <g key={String(tf)}>
          <rect x={Number(x)} y={50} width={80} height={80} rx={14} fill={i === 0 ? CHART : i === 1 ? ACCENT : UP} opacity={0.14} />
          <T x={Number(x) + 40} y={85} c={INK} b s={12}>{tf}</T>
          <T x={Number(x) + 40} y={102} s={9}>{what}</T>
          {i < 2 && <Path d={`M${Number(x) + 84} 90 L${Number(x) + 116} 90 M${Number(x) + 110} 85 L${Number(x) + 116} 90 L${Number(x) + 110} 95`} c={MUTE} w={1.5} />}
        </g>
      ))}
      <T x={160} y={30} c={INK} b s={11}>Top-down: direction → location → timing</T>
    </g>
  ),
  shift: () => (
    <g>
      <Path d="M20 40 L60 80 L80 65 L120 120 L140 100 L170 150 L200 95 L215 110 L250 60 L300 40" />
      <HLine y={100} x1={130} x2={300} c={UP} label="Last lower high" />
      <Dot x={170} y={150} c={DOWN} r={4} />
      <T x={170} y={168} c={DOWN} s={9} b>sweep at POI</T>
      <Dot x={238} y={77} c={UP} r={4} />
      <T x={268} y={95} c={UP} s={9} b>body close above = shift</T>
      <Zone y1={108} y2={122} x1={190} x2={300} c={UP} label="limit here" />
    </g>
  ),
  risk: () => (
    <g>
      <rect x={60} y={30} width={200} height={66} fill={UP} opacity={0.15} />
      <rect x={60} y={96} width={200} height={22} fill={DOWN} opacity={0.18} />
      <HLine y={30} x1={60} x2={260} c={UP} dash="0" label="Target  +3R" />
      <HLine y={96} x1={60} x2={260} c={INK} dash="0" label="Entry" />
      <HLine y={118} x1={60} x2={260} c={DOWN} dash="0" label="Stop  −1R" />
      <T x={160} y={150} c={INK} b s={11}>Size = risk $ ÷ (stop distance × contract)</T>
      <T x={160} y={166} s={9}>Win 25% of the time at 1:3 → still breakeven</T>
    </g>
  ),
  gate: () => (
    <g>
      {["HTF aligned", "Correct half", "In a quality POI", "Liquidity swept", "Market shift", "In window, news clear", "R:R ≥ 1:3"].map((t, i) => (
        <g key={t}>
          <rect x={30 + (i % 2) * 140} y={18 + Math.floor(i / 2) * 36} width={128} height={28} rx={8} fill={UP} opacity={0.12} />
          <T x={44 + (i % 2) * 140} y={36 + Math.floor(i / 2) * 36} a="start" c={INK} s={10}>✓ {t}</T>
        </g>
      ))}
      <T x={240} y={168} c={DOWN} b s={10}>Any ✕ → no trade</T>
    </g>
  ),
  news: () => (
    <g>
      <line x1={40} x2={280} y1={100} y2={100} stroke={LINE} strokeWidth={6} strokeLinecap="round" />
      <rect x={130} y={92} width={40} height={16} rx={4} fill={DOWN} opacity={0.6} />
      <rect x={170} y={92} width={60} height={16} rx={4} fill={ACCENT} opacity={0.45} />
      <line x1={150} x2={150} y1={70} y2={130} stroke={DOWN} strokeWidth={2} />
      <T x={150} y={62} c={DOWN} b>CPI 18:00</T>
      <T x={150} y={145} s={9} c={DOWN}>±15 min: no entries</T>
      <T x={200} y={125} s={9} c={ACCENT}>wait 30–60 min</T>
      <T x={160} y={30} c={INK} b s={11}>Spreads widen, stops slip — sit it out</T>
    </g>
  ),
  journal: () => (
    <g>
      {["Record", "Review", "Reflect", "Refine", "Reassess"].map((t, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const x = 160 + Math.cos(a) * 62;
        const y = 92 + Math.sin(a) * 62;
        return (
          <g key={t}>
            <circle cx={x} cy={y} r={24} fill={CHART} opacity={0.15} />
            <T x={x} y={y + 3} c={INK} b s={9}>{t}</T>
          </g>
        );
      })}
      <T x={160} y={96} c={CHART} b s={11}>5R loop</T>
    </g>
  ),
  psych: () => (
    <g>
      <Path d="M30 120 C 70 40, 110 40, 150 100 S 230 160, 290 60" c={CHART} w={3} />
      <T x={60} y={150} s={9}>FOMO</T>
      <T x={150} y={150} s={9}>Revenge</T>
      <T x={240} y={150} s={9}>Overconfidence</T>
      <T x={160} y={28} c={INK} b s={11}>Process over outcome — same rules every trade</T>
    </g>
  ),
  market: () => (
    <g>
      {[["Forex", "EURUSD · 100k/lot", 20], ["Gold", "XAUUSD · 100 oz/lot", 120], ["Crypto", "BTC perp · 1 BTC", 220]].map(([n, d, x]) => (
        <g key={String(n)}>
          <rect x={Number(x)} y={55} width={80} height={70} rx={14} fill={ACCENT} opacity={0.14} />
          <T x={Number(x) + 40} y={88} c={INK} b s={12}>{n}</T>
          <T x={Number(x) + 40} y={105} s={8}>{d}</T>
        </g>
      ))}
      <T x={160} y={34} c={INK} b s={11}>Same price action, different contract sizes</T>
      <T x={160} y={150} s={9}>Pick one or two instruments and master them</T>
    </g>
  ),
  bias: () => (
    <g>
      <Path d="M20 150 L60 110 L80 125 L130 50 L160 90 L180 80" c={INK} />
      <HLine y={50} x1={110} x2={300} c={DOWN} label="PDH — magnet" />
      <HLine y={150} x1={20} x2={300} c={MUTE} label="Swing low" />
      <HLine y={100} x1={20} x2={300} c={ACCENT} label="50%" />
      <Path d="M180 80 L215 118" c={UP} dash="4 4" />
      <Path d="M215 118 L280 55" c={UP} dash="4 4" />
      <T x={215} y={140} c={UP} s={9} b>long from discount</T>
    </g>
  ),
  obfvg: () => (
    <g>
      <Path d="M20 60 L60 100 L80 90 L110 150 L130 120" c={INK} />
      <Zone y1={138} y2={156} x1={98} x2={300} c={UP} label="OB" />
      <rect x={128} y={110} width={172} height={16} fill={CHART} opacity={0.25} rx={3} />
      <T x={296} y={122} a="end" c={CHART} s={9} b>FVG — limit here</T>
      <Path d="M130 120 L160 50 L190 80" c={INK} />
      <Dot x={110} y={150} c={DOWN} />
      <T x={110} y={170} c={DOWN} s={9}>sweep</T>
      <T x={200} y={70} a="start" s={9}>tighter stop → easier 1:3</T>
    </g>
  ),
};

export const ILLO_KEYS = Object.keys(ILLOS);

export default function AcademyIllo({ name, className = "" }: { name: string; className?: string }) {
  const Draw = ILLOS[name];
  if (!Draw) return null;
  return (
    <svg viewBox="0 0 320 180" className={`h-auto w-full ${className}`} role="img" aria-label={`Diagram: ${name}`}>
      <rect x={0} y={0} width={320} height={180} rx={16} fill="rgb(var(--raised))" opacity={0.5} />
      <Draw />
    </svg>
  );
}
