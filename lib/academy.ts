/**
 * A+ Academy — two learning paths written for this app.
 * Explanations are our own, organised from the knowledgebase (Brad Go "Market Mechanics" lessons, referenced by video number)
 * and the A+ playbook. Nothing here is financial advice.
 */

export type Path = "beginner" | "pro";
export type Lesson = {
  id: string;
  path: Path;
  title: string;
  minutes: number;
  summary: string;
  illo: string;
  body: { h: string; p: string[] }[];
  example: { title: string; text: string[] };
  takeaways: string[];
  check?: { q: string; options: string[]; answer: number; why: string };
  sources: number[];
};

export const SOURCE_URL: Record<number, string> = {
  1: "https://youtu.be/zAHALFQDqLs", 3: "https://youtu.be/UYnCQEHx7ZU", 8: "https://youtu.be/H-gaL7ccJt8", 13: "https://youtu.be/rqwiL8aNYHY",
  15: "https://youtu.be/xwvPmhArfEY", 16: "https://youtu.be/wZyxxo0qkPo", 17: "https://youtu.be/vP9gmvxdFd8", 19: "https://youtu.be/waLWuc6_HC0",
  20: "https://youtu.be/Dc0Z1B6jckA", 21: "https://youtu.be/52aKS7HN_jI", 22: "https://youtu.be/xR1KUjv0PB8", 23: "https://youtu.be/9P-u7MWosFo",
  24: "https://youtu.be/kIBIM4by-Sc", 25: "https://youtu.be/qtrATSo3-lQ", 26: "https://youtu.be/uLw-qdpV3uk", 27: "https://youtu.be/TthzSVTzWoE",
  28: "https://youtu.be/mdR4xijBaKE", 29: "https://youtu.be/8ZfPIVt4IBs", 30: "https://youtu.be/4MG3uUyoQCc", 31: "https://youtu.be/gECKHjUnEjU",
  32: "https://youtu.be/gi1h5Fvn7nY", 33: "https://youtu.be/kVEx1QzLfQ0", 34: "https://youtu.be/JRiiQWeooMc", 35: "https://youtu.be/1s8ea5SH7ZA",
  36: "https://youtu.be/JxiRzhjq2t8", 37: "https://youtu.be/Gx6KAhhWn10", 39: "https://youtu.be/V4Unokfrqjw", 40: "https://youtu.be/xoUlvwdBVJ4",
  41: "https://youtu.be/IieXTRD15GU", 44: "https://youtu.be/jl9t6KMoiHg", 45: "https://youtu.be/kRYQFKysfis", 46: "https://youtu.be/TIpUnwVftgU",
  50: "https://youtu.be/MypSrcfiqtM", 51: "https://youtu.be/en8RMFRqSME", 61: "https://youtu.be/TOpg1R0QqTA", 62: "https://youtu.be/6nMqpn8O9NE",
};

export const PATHS: { id: Path; title: string; tagline: string; blurb: string }[] = [
  {
    id: "beginner",
    title: "Beginner path",
    tagline: "From zero to reading a chart like a professional",
    blurb: "Markets, candles, structure, liquidity, zones, timing, risk and the habits that keep you in the game — one idea at a time, in order.",
  },
  {
    id: "pro",
    title: "Pro path",
    tagline: "Market mechanics and our A+ setups",
    blurb: "The full daily process: bias, POIs, the A+ gate, three entry models, management, instrument playbooks and passing prop challenges.",
  },
];

export const LESSONS: Lesson[] = [
  /* ============================== BEGINNER ============================== */
  {
    id: "markets-and-instruments",
    path: "beginner",
    title: "Markets, instruments and how you get paid",
    minutes: 6,
    summary: "What you are actually trading, what a lot or contract is, and why leverage is a tool, not a target.",
    illo: "market",
    body: [
      { h: "What a trade is", p: ["A trade is a bet on direction with a defined exit if you are wrong. You buy (go long) if you expect price to rise and sell (go short) if you expect it to fall. Your profit or loss is the price move multiplied by how much you hold.", "Forex pairs, gold (XAUUSD) and crypto perpetuals all move on the same forces — orders from buyers and sellers — so the same chart-reading skills work on all of them."] },
      { h: "Size: lots and contracts", p: ["Each instrument has a contract size. One standard forex lot is 100,000 units of the base currency; one gold lot is 100 ounces, so a $1 move in gold is $100 per lot; one BTC perpetual contract is usually 1 BTC.", "You never pick size by feel. You pick it from the money you are willing to lose and the distance to your stop — that is covered in the risk lesson."] },
      { h: "Leverage and prop firms", p: ["Leverage lets you control a large position with a small deposit (margin). It does not change how much you lose per point — size does. Prop firms give you their capital under rules such as a daily loss limit and a maximum drawdown; break a rule and the account is gone.", "That is why this app is built around guardrails: the rules of the account matter more than any single trade."] },
    ],
    example: { title: "Same move, different size", text: ["Gold moves from 2,400 to 2,403 — a $3 move.", "0.10 lots (10 oz) → $30. 0.50 lots (50 oz) → $150. Same chart, five times the result — and five times the loss if it went the other way."] },
    takeaways: ["Long = profit if price rises; short = profit if it falls.", "Know your contract size: FX 100k, gold 100 oz, BTC 1.", "Leverage changes margin, not risk. Size changes risk.", "Prop accounts live or die by their rules — learn them first."],
    check: { q: "Gold moves $2 against you while you hold 0.25 lots. What is the loss?", options: ["$2", "$25", "$50", "$500"], answer: 2, why: "0.25 lots × 100 oz = 25 oz; 25 × $2 = $50." },
    sources: [1, 17, 3],
  },
  {
    id: "candlesticks",
    path: "beginner",
    title: "Reading candlesticks",
    minutes: 5,
    summary: "Every candle is a small story of who won a period: open, high, low and close.",
    illo: "candles",
    body: [
      { h: "Anatomy", p: ["A candle shows four prices for one period: open, high, low, close. The body spans open to close; the wicks show how far price travelled beyond the body before being pushed back.", "A close above the open is bullish (buyers won the period); a close below is bearish."] },
      { h: "What the shapes say", p: ["Large bodies with small wicks mean one side was in control — momentum. Long wicks mean rejection: price tried to go somewhere and was pushed back. A run of small, overlapping candles means balance — nobody is winning yet.", "We care most about where a candle closes. A wick through a level is a probe; a body close beyond it is commitment. That distinction is the heart of the market-shift trigger later on."] },
      { h: "Context beats patterns", p: ["A hammer in the middle of nowhere means little. The same rejection inside a planned zone, after liquidity was taken, means a lot. Read candles as evidence inside your plan, not as signals on their own."] },
    ],
    example: { title: "Wick versus close", text: ["Price spikes above yesterday's high on 5M, but the candle closes back below it with a long upper wick.", "Reading: buyers were trapped above the high and sellers took control. That is a sweep, not a breakout."] },
    takeaways: ["Body = conviction, wick = rejection.", "Closes matter more than wicks.", "Small overlapping candles = balance; big full candles = imbalance.", "Read candles in context, never alone."],
    check: { q: "Which is stronger evidence that a level has broken?", options: ["A long wick through it", "A body close beyond it", "Three touches of it", "A doji at it"], answer: 1, why: "A body close shows the period ended beyond the level — commitment, not a probe." },
    sources: [20, 62],
  },
  {
    id: "how-markets-move",
    path: "beginner",
    title: "How the market moves: balance and imbalance",
    minutes: 6,
    summary: "Price cycles through expansion, pullback, consolidation and then continuation or reversal — again and again.",
    illo: "cycle",
    body: [
      { h: "Balance and imbalance", p: ["When buyers and sellers agree on value, price ranges — that is balance. When one side overwhelms the other, price moves fast and leaves inefficiency behind — that is imbalance.", "Big moves start from balance. Your job is to be positioned before the imbalance, not to chase it after."] },
      { h: "The four stages", p: ["Expansion: a strong move in one direction. Pullback: price drifts back toward fair value. Consolidation: compression while the two sides fight. Then either continuation (the original side wins again) or reversal (the other side takes over).", "Every timeframe shows this cycle. A 4H pullback can contain a full 5M cycle inside it — which is exactly how multi-timeframe entries work."] },
      { h: "Why it matters for you", p: ["If you know which stage you are in, you know what to expect next. Buying at the top of an expansion is buying late; buying the end of a pullback into a planned zone is buying early, with a small stop."] },
    ],
    example: { title: "Spotting the stage", text: ["BTC rallies 3% in two hours (expansion), drifts lower for a session (pullback), then chops in a tight range (consolidation).", "Plan: wait for that range to resolve. If it sweeps its low and shifts back up inside your demand zone, that is continuation — your long."] },
    takeaways: ["Balance builds the fuel; imbalance spends it.", "Expansion → pullback → consolidation → continuation or reversal.", "Enter at the end of pullbacks, not the end of expansions.", "The cycle repeats on every timeframe."],
    sources: [15, 16],
  },
  {
    id: "market-structure",
    path: "beginner",
    title: "Market structure: trends, breaks and shifts",
    minutes: 7,
    summary: "Higher highs and higher lows define an uptrend; the break of the last higher low is the first warning it is over.",
    illo: "structure",
    body: [
      { h: "Swings define the trend", p: ["An uptrend prints higher highs (HH) and higher lows (HL). A downtrend prints lower highs (LH) and lower lows (LL). Mark only clear swings — points where price turned with intent.", "A break of structure (BOS) in the trend's direction — a new HH in an uptrend — confirms continuation."] },
      { h: "The protected level", p: ["In an uptrend, the higher low that produced the latest higher high is the one that matters. While it holds, the trend is intact. When price closes below it, structure has shifted: that is a market shift (sometimes called a change of character).", "In a downtrend, mirror it: the lower high that produced the latest lower low is protected."] },
      { h: "Internal versus swing structure", p: ["Inside a big swing there are smaller swings. Higher timeframes give you the swing structure (direction). Lower timeframes give you internal structure (timing). We trade the lower-timeframe shift only when it agrees with the higher-timeframe direction."] },
    ],
    example: { title: "Reading a shift", text: ["1H gold makes HH at 2,412 from a HL at 2,396. Later it closes at 2,394 — below the protected low.", "Bias is no longer long. Either stand aside or wait for bearish structure to build (a lower high) before looking for shorts."] },
    takeaways: ["Uptrend = HH + HL; downtrend = LH + LL.", "The protected low/high is the line in the sand.", "A body close through it = market shift.", "Trade lower-timeframe shifts in the higher-timeframe direction."],
    check: { q: "In an uptrend, which close signals a market shift?", options: ["Above the last higher high", "Below the last higher low", "Below the previous candle", "At the 50% level"], answer: 1, why: "Losing the protected higher low breaks the sequence of higher lows." },
    sources: [19, 62],
  },
  {
    id: "liquidity",
    path: "beginner",
    title: "Liquidity: where the stops are",
    minutes: 6,
    summary: "Price is drawn to clusters of resting orders — above equal highs, below equal lows, and around the previous day's range.",
    illo: "liquidity",
    body: [
      { h: "What liquidity is", p: ["Large players need someone on the other side of their orders. Clusters of stop-losses and breakout orders provide that. They collect where most traders put them: just above obvious highs and just below obvious lows.", "Buy-side liquidity rests above highs (shorts' stops, breakout buys). Sell-side liquidity rests below lows (longs' stops, breakout sells)."] },
      { h: "Where to look", p: ["Equal highs and equal lows (double tops and bottoms), the previous day high (PDH) and low (PDL), session highs and lows (for example the Asia range), and clean trendlines.", "The more obvious the level, the more orders sit behind it — and the more likely price is to visit it."] },
      { h: "The magnet", p: ["Each morning, decide which pool is the likely target — the magnet. In a bullish day, resting buy-side liquidity above PDH is a natural target; in a bearish day, sell-side below PDL. Your trade idea should travel toward the magnet."] },
    ],
    example: { title: "Morning map", text: ["BTC has equal highs at 84,950 and yesterday's high at 85,100, with clean lows at 83,600.", "In a bullish context the magnet is 85,100: targets go there, and you avoid shorting into it."] },
    takeaways: ["Stops cluster above highs and below lows.", "Equal highs/lows, PDH/PDL and session ranges are the big pools.", "Pick a daily magnet and trade toward it.", "Obvious levels attract price."],
    sources: [13, 29],
  },
  {
    id: "sweeps-inducement",
    path: "beginner",
    title: "Sweeps and inducement",
    minutes: 6,
    summary: "The fake move before the real move: price takes the obvious stops, then reverses.",
    illo: "sweep",
    body: [
      { h: "The sweep", p: ["A liquidity sweep is a quick run through a pool of stops followed by rejection. It fills the large orders waiting on the other side. On the chart it looks like a wick through a high or low and a close back inside.", "A sweep at your planned zone is one of the strongest signals in this method: no sweep, no trade."] },
      { h: "Inducement", p: ["Inducement is the bait — a structure that tempts traders to enter early: a neat double bottom inside a pullback, a minor trendline, a small range. Traders buy it, place stops just under it, and create the liquidity that price then takes.", "Learn to see these as fuel rather than signals. When you see an obvious pattern before your zone, expect it to be swept first."] },
      { h: "Patience is the edge", p: ["Most retail entries happen at the inducement. Ours happen after it is taken, inside the zone, once structure shifts. That costs you some trades that never come back — and saves you many that would have stopped you out."] },
    ],
    example: { title: "Trap and reverse", text: ["Gold forms a double bottom at 2,388 just above a 15M demand zone.", "You wait. Price spikes to 2,384 — through the lows and into the zone — then a 5M candle closes back above the last lower high. That is your trigger, with the sweep low as the stop."] },
    takeaways: ["Sweep = run through stops + rejection.", "Inducement = the obvious pattern before the real level.", "Enter after the sweep, not before it.", "No liquidity taken → no entry."],
    check: { q: "Price prints a perfect double bottom just above your demand zone. What do you do?", options: ["Buy the double bottom", "Expect the lows to be swept into the zone and wait", "Short it", "Move your zone up"], answer: 1, why: "Obvious lows above a zone are inducement; the stops below them are fuel for the real move from the zone." },
    sources: [27, 13],
  },
  {
    id: "supply-demand",
    path: "beginner",
    title: "Supply and demand zones",
    minutes: 8,
    summary: "Zones are where big orders started a strong move. Quality comes from momentum, structure, freshness and time.",
    illo: "supplydemand",
    body: [
      { h: "Where zones come from", p: ["Before a strong move there is usually a small base — a few candles of balance where large orders were filled. The fast move away (imbalance) shows those orders overwhelmed the other side. Unfilled orders remain, so when price returns, it often reacts.", "Demand zones sit below price (buy area); supply zones sit above (sell area). Draw them around the base candles that launched the move."] },
      { h: "Five checks for quality", p: ["1) Momentum: the faster and fuller the move away, the stronger the zone. 2) Structure: the move away should break structure. 3) Trend: buy demand in uptrends, sell supply in downtrends. 4) Depth: if price pushes through most of a zone, it usually fails. 5) Time: good zones react within a candle or two; price lingering inside is a warning.", "Extreme zones (the origin of the whole leg) are usually stronger than the many small zones in the middle of a move."] },
      { h: "Zones plus liquidity", p: ["The best zones also have a liquidity story: they swept a low (demand) or high (supply) when they formed, or they sit just beyond an obvious pool that will be swept on the way in."] },
    ],
    example: { title: "Grading two zones", text: ["Zone A: launched a one-candle 40-point rally that broke the last high. Zone B: launched a slow three-candle drift that broke nothing.", "Zone A is high quality. Zone B is one you ignore."] },
    takeaways: ["Zone = base before a strong, structure-breaking move.", "Momentum, structure, trend, depth and time grade a zone.", "Prefer extreme zones with a liquidity story.", "Price lingering in a zone is a warning sign."],
    sources: [21, 61, 10],
  },
  {
    id: "premium-discount",
    path: "beginner",
    title: "Premium and discount",
    minutes: 5,
    summary: "Buy cheap, sell expensive: split the current range in half and only trade from the correct side.",
    illo: "premiumdiscount",
    body: [
      { h: "The range", p: ["Take the most recent higher-timeframe swing that broke structure — from its swing low to its swing high. That is the dealing range. Draw a fib or simply mark its 50% level (equilibrium)."] },
      { h: "Which half", p: ["Above 50% is premium — expensive. Below 50% is discount — cheap. In an uptrend you only look for longs in discount. In a downtrend you only look for shorts in premium.", "Price sitting around the middle is no-man's-land: poor reward on both sides. That is a no-trade condition in our gate."] },
      { h: "Why it works", p: ["Buying in discount gives the trade room to run to the highs, which makes 1:3 targets realistic. Buying in premium means your target is already close and your stop is usually far."] },
    ],
    example: { title: "Where to buy", text: ["4H BTC swing: 81,200 → 86,900. Equilibrium = 84,050.", "In an uptrend, longs only below 84,050 — ideally from a demand zone near 82,500 that swept a low."] },
    takeaways: ["Range = latest swing that broke structure.", "Longs in discount, shorts in premium.", "Mid-range = no trade.", "Correct half makes 1:3 achievable."],
    check: { q: "Uptrend, range 2,380–2,420, price at 2,414. Long or wait?", options: ["Long now", "Wait — price is in premium", "Short — it's premium", "Long with a wider stop"], answer: 1, why: "In an uptrend you buy discount (below 2,400). At 2,414 price is in premium: wait for a pullback." },
    sources: [22, 29],
  },
  {
    id: "fair-value-gaps",
    path: "beginner",
    title: "Fair value gaps (imbalance)",
    minutes: 5,
    summary: "A three-candle pattern that shows where price moved too fast — and often comes back to.",
    illo: "fvg",
    body: [
      { h: "Spotting one", p: ["Look at three candles. If the high of candle 1 and the low of candle 3 do not overlap (in a bullish move), the gap between them is a fair value gap (FVG). Price moved so fast that only one side traded there.", "A bearish FVG mirrors it: the gap between candle 1's low and candle 3's high."] },
      { h: "How we use them", p: ["FVGs show intent: real money pushed price. They often get revisited before the move continues. Inside or next to an order block, an FVG gives a precise, tight entry — that is our third entry model.", "An FVG on its own is not a reason to trade. It is a refinement inside a zone you already planned."] },
      { h: "Unfilled gaps as targets", p: ["An unfilled FVG in the direction of your trade is also a reasonable target, because price tends to rebalance it."] },
    ],
    example: { title: "Tightening an entry", text: ["Your 15M demand zone is 12 points tall. Inside it, the 5M leg away left a 3-point FVG.", "Entering at the FVG with the stop under the zone's sweep low cuts risk distance — the same 1R target is now 1:4."] },
    takeaways: ["FVG = gap between wick 1 and wick 3.", "Shows intent and often gets revisited.", "Use it to refine entries inside planned zones.", "Unfilled FVGs make good targets."],
    sources: [23, 50],
  },
  {
    id: "order-blocks",
    path: "beginner",
    title: "Order blocks",
    minutes: 5,
    summary: "The last opposite candle before a sharp, imbalanced move — the footprint of where big orders went in.",
    illo: "orderblock",
    body: [
      { h: "Definition", p: ["A bullish order block is the last down candle (or pivot candle) before a sharp move up that leaves an imbalance and breaks structure. A bearish order block is the last up candle before a sharp move down.", "The move matters more than the candle: no imbalance and no break of structure means no order block."] },
      { h: "Drawing it", p: ["Mark the high and low of that pivot candle. If the very next candle traded deep through it, move to the candle that actually launched the move — you want the unmitigated origin.", "Order blocks are smaller and more precise than broad supply/demand zones, so they pair well with a sweep and an FVG."] },
    ],
    example: { title: "Valid or not", text: ["After a sweep of the Asia low, one red 5M candle is followed by three strong green candles that leave a gap and break the last lower high.", "That red candle is a valid bullish order block. A red candle followed by a slow grind up is not."] },
    takeaways: ["Last opposite candle before an impulsive move.", "Needs imbalance + break of structure to count.", "Use the unmitigated origin.", "Best combined with a sweep and FVG."],
    sources: [24, 50],
  },
  {
    id: "flip-zones",
    path: "beginner",
    title: "Flip zones",
    minutes: 6,
    summary: "When a zone fails and structure breaks, the failed reaction becomes a new zone on the other side.",
    illo: "flipzone",
    body: [
      { h: "How a flip forms", p: ["In an uptrend, price returns to demand and bounces — but fails to make a new high. That weak bounce is a failed reaction. If price then closes below the last higher low (a shift), buyers have lost control.", "Draw the flip zone from the top to the bottom of the failed reaction. It now acts as supply."] },
      { h: "Why it works", p: ["The traders who bought the demand are trapped. When price comes back to where they bought, many exit at breakeven, and fresh sellers step in. The sentiment has flipped and so has the order flow."] },
      { h: "Our tie-break", p: ["If both a flip zone and a more extreme zone exist, the extreme one often wins, because the liquidity beyond the flip gets swept first. Prefer the extreme zone, or wait for the flip to sweep and shift."] },
    ],
    example: { title: "Supply flip", text: ["15M gold: demand at 2,390 holds once, bounce stalls at 2,401 (below the 2,405 high), then a close below 2,393.", "The 2,397–2,401 failed reaction is now a supply flip zone: look for shorts on the pullback into it after a 5M shift down."] },
    takeaways: ["Failed reaction + market shift = flip zone.", "Draw it across the failed reaction.", "Trapped traders create the reaction.", "Prefer the extreme zone if both exist."],
    sources: [28, 32],
  },
  {
    id: "multi-timeframe",
    path: "beginner",
    title: "Multi-timeframe analysis",
    minutes: 5,
    summary: "Higher timeframe for direction, middle for location, lower for timing.",
    illo: "mtf",
    body: [
      { h: "Three jobs, three timeframes", p: ["4H (BTC) or 1H (gold) answers: which way and where in the range? 15M answers: where exactly are the zones worth trading? 5M/1M answers: has price confirmed, right now, inside my zone?", "Do not mix the jobs. A 1M pattern does not override the 4H trend."] },
      { h: "Alignment", p: ["The cleanest trades happen when all three agree: the higher timeframe trend, a trend-aligned 15M zone in the correct half, and a lower-timeframe shift in the same direction.", "When the 1H and 15M disagree, stand aside — it is one of the most common reasons good-looking trades fail."] },
    ],
    example: { title: "Top-down in five minutes", text: ["1H gold: uptrend, price in discount. 15M: demand zone at 2,386–2,390 that swept a low. 5M: after the tap, a close above the last lower high.", "All three agree — that is a candidate A+ long."] },
    takeaways: ["HTF = direction, 15M = location, LTF = timing.", "All three must agree.", "Lower timeframes never override higher ones.", "Disagreement = no trade."],
    sources: [25],
  },
  {
    id: "sessions",
    path: "beginner",
    title: "Sessions and timing (Q-zones)",
    minutes: 5,
    summary: "The market is open 24 hours, but clean moves cluster in a few windows. Pick one and own it.",
    illo: "sessions",
    body: [
      { h: "Each session has a personality", p: ["Asia tends to range and build liquidity. London often expands and sweeps the Asia high or low. New York brings US data and either continues London's move or reverses it. Late London tends to slow down.", "Our windows are defined in New York time — London 02:00–05:00, New York 07:00–10:00 — and the app converts them to your time zone (see the slider on Today)."] },
      { h: "Pick your window", p: ["Choose the window you can trade with full attention — not the one that fits a fantasy schedule. Gold and BTC both move well in the New York window.", "Outside your window, the app treats you as off-session: entries are flagged off-plan."] },
    ],
    example: { title: "Asia sweep", text: ["Asia ranges between 2,395 and 2,402. In a bullish daily context, London sweeps 2,395, taps 15M demand, and shifts up.", "That is a classic timing pattern: Asia builds the pool, London takes it."] },
    takeaways: ["Trade the Q-zones, not all day.", "Asia builds, London expands, New York decides.", "Pick one window per account and stick to it.", "Off-session entries are off-plan."],
    sources: [26],
  },
  {
    id: "risk-sizing",
    path: "beginner",
    title: "Risk, R and position sizing",
    minutes: 7,
    summary: "Risk a small fixed slice per trade, size from the stop, and think in R — not dollars.",
    illo: "risk",
    body: [
      { h: "Thinking in R", p: ["1R is what you lose if your stop is hit. A trade that makes three times that is +3R. Measuring in R lets you compare trades across accounts and sizes.", "At 1:3, you break even winning only 25% of the time. At a 35% win rate, the expectancy is +0.40R per trade."] },
      { h: "Position size", p: ["Size = risk in $ ÷ (stop distance × contract size), plus fees. Gold: $125 risk with a $3 stop → 125 ÷ (3 × 100) ≈ 0.41 lots. BTC: $25 risk, $400 stop at 82,800 with 0.08% round-trip fees → 25 ÷ (400 + 66) ≈ 0.054 BTC.", "The New trade screen does this for you and shows +1R/+2R levels, max loss and room to your daily stop."] },
      { h: "Guardrails", p: ["Risk 0.25–1% per trade, cap trades per day, stop after two losses, and cut risk after a losing streak. The risk ladder in Accounts automates this from your equity."] },
    ],
    example: { title: "Same plan, two stops", text: ["Gold, $125 risk. Stop $5 away → 0.25 lots. Stop $2 away → 0.62 lots.", "The dollar risk is identical; only the size changes. Never widen a stop to fit a size."] },
    takeaways: ["Think in R; 1:3 needs only 25% wins to break even.", "Size = risk ÷ (stop × contract).", "Small fixed risk + daily limits keep you alive.", "Let the stop set the size, never the reverse."],
    check: { q: "$100 risk, gold stop distance $4. What size?", options: ["0.10 lots", "0.25 lots", "0.40 lots", "1.00 lot"], answer: 1, why: "100 ÷ (4 × 100) = 0.25 lots." },
    sources: [35, 45],
  },
  {
    id: "news",
    path: "beginner",
    title: "Trading around news",
    minutes: 4,
    summary: "High-impact releases make spreads widen and stops slip. We step aside around them.",
    illo: "news",
    body: [
      { h: "The rule", p: ["Check the economic calendar before every session. For high-impact events (CPI, NFP, FOMC, rate decisions), no new entries from 15 minutes before to 15 minutes after, and give price 30–60 minutes to settle.", "Never move or remove a stop because of news."] },
      { h: "In the app", p: ["The economic calendar on Today shows the week's events in your time zone. One tap blocks today's times in your plans, and the guardrails flag any entry inside a block."] },
    ],
    example: { title: "CPI day", text: ["US CPI at 08:30 New York time. Your window is 07:00–10:00.", "Plan: trade only setups that trigger and complete before 08:15, or wait until after about 09:15."] },
    takeaways: ["Check the calendar first.", "±15 minutes around high-impact news: no entries.", "Wait 30–60 minutes after.", "Never move a stop for news."],
    sources: [44],
  },
  {
    id: "journal-review",
    path: "beginner",
    title: "Journaling and the 5R review",
    minutes: 5,
    summary: "Your edge lives in your own data. Record daily, review weekly, reflect monthly, refine quarterly, reassess yearly.",
    illo: "journal",
    body: [
      { h: "What to log", p: ["Every trade: setup, gate checks, levels, size, screenshots before and after, emotions, and one line on what you would repeat or fix. Log it live — the app marks trades recorded within 30 minutes as logged live."] },
      { h: "The 5R loop", p: ["Record daily. Review weekly (numbers and rule-compliance). Reflect monthly (patterns and emotions). Refine quarterly (change one rule, with data). Reassess yearly (goals). Do not change your system on a week of results — the sample is too small."] },
    ],
    example: { title: "One fix per month", text: ["Monthly review shows 6 of 8 losses came from entries without a sweep.", "One refinement: no sweep, no entry — enforced by the gate. Measure next month."] },
    takeaways: ["Log every trade live, with screenshots.", "Review weekly, refine quarterly.", "Change one thing at a time.", "Judge a system on 50–100 trades."],
    sources: [37, 40],
  },
  {
    id: "psychology",
    path: "beginner",
    title: "Psychology and discipline",
    minutes: 5,
    summary: "Process over outcome. The same rules on the hundredth trade as on the first.",
    illo: "psych",
    body: [
      { h: "The usual enemies", p: ["FOMO (chasing a move you missed), revenge trading (trying to win back a loss now), and overconfidence after a streak. All three replace the plan with a feeling.", "The app asks how you feel before each trade and tracks emotions over time, so you can see which states cost you money."] },
      { h: "Practical defences", p: ["Hard limits: max trades and losses per day, then walk away. A pre-trade checklist you never skip. A daily check-in. And honest reviews that grade the decision, not the outcome — a rule-following loss is a good trade.", "Strategy-hopping after a losing streak is the most expensive habit there is. Losing streaks are normal at a 35% win rate."] },
    ],
    example: { title: "After two losses", text: ["Two stop-outs before 10:00. Your rule says stop. You feel a perfect setup forming.", "Close the platform. Log what you felt. The setup will come back another day; the account might not."] },
    takeaways: ["Grade decisions, not outcomes.", "Hard daily limits beat willpower.", "Losing streaks are normal — don't hop strategies.", "Track your emotions; they show up in the numbers."],
    sources: [8, 36, 41, 46],
  },

  /* ============================== PRO ============================== */
  {
    id: "a-plus-process",
    path: "pro",
    title: "The A+ process, end to end",
    minutes: 6,
    summary: "One repeatable routine: prepare, wait, confirm, execute, review. At most one or two A+ trades per account per day.",
    illo: "mtf",
    body: [
      { h: "Before the session (15 minutes)", p: ["Calendar → HTF range → premium/discount → liquidity and magnet → narrative and invalidation → 15M POIs → alerts. Then walk away until price is inside a POI.", "The Plan screen mirrors this checklist and saves your bias, levels, window and news times per account."] },
      { h: "In the session", p: ["On an alert, drop to 5M/1M, wait for an entry model, run the A+ gate, size from the stop, set entry, stop and target — then leave it."] },
      { h: "After", p: ["Log the trade with screenshots and one review line. Weekly, look at compliance and expectancy, not just P&L."] },
    ],
    example: { title: "A quiet good day", text: ["You plan two POIs on gold. Neither is reached in your window.", "Zero trades is a successful day: you followed the process and protected the account."] },
    takeaways: ["Same routine every day.", "Alerts, not screen-staring.", "1–2 A+ trades max per account.", "No setup is a valid outcome."],
    sources: [31, 30, 29],
  },
  {
    id: "daily-bias",
    path: "pro",
    title: "Daily bias in six steps",
    minutes: 7,
    summary: "Decide direction, location and the magnet before the session — and write down what would prove you wrong.",
    illo: "bias",
    body: [
      { h: "The six steps", p: ["1) HTF range: on 4H (BTC) or 1H (gold), find the latest break of structure and mark its swing low and high. 2) Premium/discount: longs only below 50%, shorts only above. 3) Liquidity: mark PDH, PDL, equal highs/lows; choose the magnet. 4) Narrative: is today a continuation or a pullback? 5) Invalidation: “Bias is wrong if price closes and holds beyond ___.” 6) 15M POIs in the correct half with a liquidity story."] },
      { h: "Bias is a filter, not a forecast", p: ["Bias tells you which trades you are allowed to take, not what will happen. If price invalidates it, you stop trading that idea — you do not argue with the market.", "“Stand aside” is a valid bias. Mid-range days and conflicting timeframes are common, and skipping them is part of the edge."] },
    ],
    example: { title: "Written bias", text: ["“Gold: 1H uptrend 2,380–2,420, price at 2,401 (mid, wait). Magnet PDH 2,424. Longs only below 2,400 from 2,386–2,390 demand (swept Asia low). Wrong if 1H closes below 2,380.”"] },
    takeaways: ["Range → half → liquidity → narrative → invalidation → POIs.", "Bias filters trades; it doesn't predict.", "Always write the invalidation.", "Stand aside is a bias."],
    sources: [29, 22],
  },
  {
    id: "quality-pois",
    path: "pro",
    title: "Choosing POIs that matter",
    minutes: 6,
    summary: "Most zones are noise. Keep only trend-aligned 15M zones in the correct half with a liquidity story.",
    illo: "supplydemand",
    body: [
      { h: "The filter", p: ["Keep a POI only if it is: aligned with the higher-timeframe trend; in the correct half of the range; strong (impulsive move away that broke structure); fresh (not already mitigated); and tied to liquidity (it swept a pool, or a pool sits just in front of it).", "Rank what is left from the extreme first. The extreme POI is usually the one that holds."] },
      { h: "Then wait", p: ["Set alerts at the top of each POI and leave the chart. You only care about price once it is inside one."] },
    ],
    example: { title: "Three zones, one keeper", text: ["BTC 15M shows three demand zones in a pullback. Zone 1 is in premium. Zone 2 is mid-leg with no sweep. Zone 3 is the leg's origin, in discount, below equal lows.", "Only Zone 3 passes. Alert at its top, wait for the equal lows to be swept into it."] },
    takeaways: ["Trend-aligned, correct half, strong, fresh, liquidity.", "Extreme first.", "Fewer, better POIs.", "Alert and walk away."],
    sources: [39, 61, 32],
  },
  {
    id: "a-plus-gate",
    path: "pro",
    title: "The A+ gate: seven checks or no trade",
    minutes: 5,
    summary: "A binary checklist before every entry. Any failed box means no trade — no exceptions without logging an override.",
    illo: "gate",
    body: [
      { h: "The seven checks", p: ["1) HTF aligned. 2) Correct half. 3) Inside a high-quality POI. 4) Liquidity swept. 5) Market shift on 5M/1M (body close beyond the last lower high or higher low). 6) Inside your window and outside the ±15 minute news block. 7) R:R of at least 1:3 to a real structural target — never stretch the target to make the math work."] },
      { h: "Automatic no-trades", p: ["Mid-range price, no sweep, no shift, HTF and 15M disagree, outside your window, you can't name the invalidation, or the nearest real target is under 3R."] },
      { h: "In the app", p: ["New trade shows the gate score out of 8 (the seven checks plus R:R from your levels). Anything less is flagged off-plan and requires a written reason — which then counts against your discipline score."] },
    ],
    example: { title: "6 of 7", text: ["Everything lines up, but the nearest real target is 2.4R away.", "That is not an A+ trade. Skip it — don't move the target to 3R."] },
    takeaways: ["All seven, every time.", "R:R comes from structure, not wishes.", "Overrides are logged and scored.", "Skipping B setups is how A+ traders get paid."],
    sources: [39, 44],
  },
  {
    id: "model-market-shift",
    path: "pro",
    title: "Setup A — Market Shift → pullback",
    minutes: 7,
    summary: "Our default model: sweep at the 15M POI, 5M body close through the last lower high, limit order at the zone that caused the shift.",
    illo: "shift",
    body: [
      { h: "Sequence (long)", p: ["1) Price taps your 15M demand POI and sweeps liquidity there. 2) On 5M, a candle body closes above the last lower high — the market shift. 3) Mark the small 5M demand zone that launched the shift. 4) Place a limit order at that zone; stop below the sweep low plus spread; target the nearest structural level at least 3R away."] },
      { h: "Rules", p: ["If the shift never pulls back to your zone, let it go — chasing breaks the R:R. If the shift fails and sweeps the other side, wait for a fresh sweep and shift.", "Mirror everything for shorts: sweep at supply, close below the last higher low, limit at the zone that caused the drop."] },
    ],
    example: { title: "Gold long", text: ["15M demand 2,386–2,390. Price sweeps to 2,385, then a 5M close at 2,394 above the last lower high at 2,393.", "Shift zone 2,389–2,391 → limit 2,391, stop 2,384.5, target 2,411 (next 15M swing high) ≈ 3.1R."] },
    takeaways: ["Sweep → shift → pullback → limit.", "Stop beyond the sweep wick.", "No pullback = no trade.", "Failed shift = wait for a new one."],
    sources: [32, 39],
  },
  {
    id: "model-flip",
    path: "pro",
    title: "Setup B — Flip zone entry",
    minutes: 6,
    summary: "An opposing lower-timeframe zone fails, structure shifts, and you enter on the pullback to the flip.",
    illo: "flipzone",
    body: [
      { h: "Sequence (long)", p: ["Inside your 15M demand POI, a small 5M supply zone forms on the way down. Price comes back up through it — it fails — and closes above the last lower high. That failed supply is now a demand flip zone. Enter on the pullback into it; stop below the swing low that formed the shift."] },
      { h: "Tie-break", p: ["When a flip zone and a more extreme zone both exist, the extreme zone usually holds, because liquidity under the flip gets swept first. Either use the extreme zone, or wait for the flip to be swept and a new shift."] },
    ],
    example: { title: "BTC flip", text: ["15M demand at 82,400. A 5M supply at 82,900 fails; a close above 83,050 shifts structure.", "Flip zone 82,850–82,950 → limit 82,950, stop 82,560, target 84,150 (PDH) ≈ 3.1R."] },
    takeaways: ["Failed opposing zone + shift = flip.", "Enter the pullback into the flip.", "Prefer the extreme zone in a tie.", "Same gate, same 3R minimum."],
    sources: [28, 32],
  },
  {
    id: "model-ob-fvg",
    path: "pro",
    title: "Setup C — Sweep → OB → FVG",
    minutes: 6,
    summary: "After the sweep and shift, refine to the FVG inside or next to the order block that launched the move for a tighter stop.",
    illo: "obfvg",
    body: [
      { h: "Sequence (long)", p: ["Sweep at the POI → impulsive move up that breaks structure → mark the order block (last down candle before the move) → mark the FVG the move left inside or just above it → limit at the FVG, stop below the OB or sweep low."] },
      { h: "Why use it", p: ["The tighter entry shrinks 1R, which makes a real 3R target reachable more often. The trade-off: price sometimes doesn't come back deep enough, so you miss more trades. That is fine — missed trades cost nothing."] },
    ],
    example: { title: "Gold refinement", text: ["Sweep low 2,384.8, OB 2,385–2,387.5, FVG 2,388.2–2,389.6; the shift candle closed at 2,396. Target: 15M high at 2,406.", "Buying the shift close: stop 2,384.4 → 11.6 pts for 10 pts of reward (0.9R) — not tradable. Limit at the FVG top 2,389.6 with the same stop: 5.2 pts → about 3.2R."] },
    takeaways: ["Sweep → OB → FVG → limit.", "Tighter stop, same structure.", "More misses, better R.", "Only inside a planned POI."],
    sources: [50, 24, 23],
  },
  {
    id: "stops-targets-management",
    path: "pro",
    title: "Stops, targets and management",
    minutes: 6,
    summary: "Stops beyond the sweep, targets at real structure ≥3R, and set-and-forget until you have data.",
    illo: "risk",
    body: [
      { h: "Stops", p: ["Just beyond the lower-timeframe zone or the sweep wick (the protected low or high), plus the spread. Never widen it, never remove it, never move it for news."] },
      { h: "Targets", p: ["The nearest structural target at least 3R away on the entry timeframe or one above: the next 15M swing, an opposing zone, PDH/PDL, or an unfilled FVG. If the nearest real target is under 3R, skip the trade."] },
      { h: "Management", p: ["For your first 30 logged trades: set and forget, to get clean data. Then test one rule: move the stop to breakeven only at +2R and after the lower timeframe prints a new swing in your favour. The app shows +1R and +2R levels on every new trade."] },
    ],
    example: { title: "The breakeven trap", text: ["You move to breakeven at +1R on every trade. Your win rate drops from 38% to 24% and the average win stays 3R.", "Expectancy fell. That is why breakeven waits for +2R and structure — and why you test it with data."] },
    takeaways: ["Stop beyond the sweep + spread.", "Targets from structure, ≥3R or skip.", "Set-and-forget for 30 trades.", "Change one management rule at a time."],
    sources: [34, 51],
  },
  {
    id: "gold-playbook",
    path: "pro",
    title: "Gold (XAUUSD) playbook",
    minutes: 5,
    summary: "Fast both ways, loves to sweep and reverse. Hard filter on 1H/15M alignment; get in fast, get out faster.",
    illo: "sweep",
    body: [
      { h: "Character", p: ["Gold sweeps highs and lows aggressively and reverses hard. The cleanest part of the move is often 45–80 minutes. Spreads widen around news and the daily rollover."] },
      { h: "How we trade it", p: ["1H for the range, 15M POIs, 5M shift. New York window. Size: lots = risk ÷ (stop $ × 100). The aggressive entry straight off the sweep without a shift is excluded from A+ — it skips the market-shift check."] },
    ],
    example: { title: "Sizing", text: ["$125 risk, $3.00 stop + $0.20 spread → 125 ÷ 320 ≈ 0.39 lots."] },
    takeaways: ["1H/15M must agree — hard filter.", "Expect sweeps; wait for the shift.", "Size from stop × 100 oz.", "No aggressive entries in A+."],
    sources: [51],
  },
  {
    id: "btc-playbook",
    path: "pro",
    title: "BTC perpetuals playbook",
    minutes: 5,
    summary: "Same framework, plus fees, mark price, funding and liquidation clusters.",
    illo: "liquidity",
    body: [
      { h: "What's different", p: ["Fees: round-trip fees can eat a big share of a tight stop — keep stops at 0.4% of price or wider so fees stay under about 17% of risk. Stops and liquidations trigger on the mark price. Positive funding means longs pay shorts. Liquidation clusters behave like liquidity pools.", "BTC trades 24/7, but the US equity open (New York window) is where it moves most cleanly."] },
      { h: "Sizing", p: ["Qty = risk ÷ (stop distance + entry × round-trip fee rate). The New trade screen includes the fee term automatically from the account's fee rate."] },
    ],
    example: { title: "Fees check", text: ["$25 risk, entry 82,800, stop $150 away (0.18%). Fees ≈ $66 per BTC → 31% of the stop-out.", "Too tight. Widen to a structural stop ≥ $330, or skip."] },
    takeaways: ["Mind fees on tight stops.", "Mark price triggers stops.", "Liquidation clusters = liquidity.", "Validate BTC rules in your own journal."],
    sources: [3, 29],
  },
  {
    id: "prop-challenges",
    path: "pro",
    title: "Passing prop challenges",
    minutes: 6,
    summary: "Small risk, a risk ladder, hard daily limits and patience. Slow passes; fast fails.",
    illo: "risk",
    body: [
      { h: "The math", p: ["At 0.5% risk and +0.4R expectancy, each trade earns about +0.2% on average. A 10% target takes about 50 trades — five to ten weeks at one or two a day. Trying to do it in a week means 3–5× the risk and a high chance of hitting the daily limit."] },
      { h: "Ladders and limits", p: ["Cut risk as equity drops (for example 0.5% → 0.25% below a threshold, and after two losses in a row). Stop after two losses or −1% in a day. Add a weekly circuit breaker. The Accounts screen stores these as your risk ladder and enforces them in guardrails."] },
    ],
    example: { title: "Drawdown mode", text: ["$25k challenge, equity $24,450 after three losses. Ladder drops risk to $62.50.", "You need 4–5 good trades to recover — but you cannot fail the challenge in one bad afternoon."] },
    takeaways: ["0.25–0.5% risk per trade.", "Ladder risk down in drawdown.", "Hard daily and weekly stops.", "Patience passes challenges."],
    sources: [45, 35],
  },
  {
    id: "when-not-to-trade",
    path: "pro",
    title: "When not to trade",
    minutes: 4,
    summary: "The trades you skip shape your curve as much as the ones you take.",
    illo: "news",
    body: [
      { h: "Skip list", p: ["Mid-range price. Conflicting timeframes. No sweep or no shift. Outside your window or inside a news block. After your daily loss limit or trade cap. When tired, stressed or chasing a loss. When you cannot name the invalidation."] },
      { h: "Make skipping easy", p: ["Decide it before the session in your plan. The app's guardrails, check-in and gate turn most of these into automatic no's."] },
    ],
    example: { title: "Friday afternoon", text: ["You're up 1.5R for the week, it's late New York, and you're bored.", "There's no planned POI in play. Close the charts — boredom is not a setup."] },
    takeaways: ["No setup is a position.", "Pre-decide your skip conditions.", "State matters as much as setup.", "Protect good weeks."],
    sources: [33, 39],
  },
  {
    id: "refining-edge",
    path: "pro",
    title: "Refining your edge with data",
    minutes: 5,
    summary: "Use Insights and the review loop to find what to stop doing — one change at a time.",
    illo: "journal",
    body: [
      { h: "What to look at", p: ["Expectancy by setup, by session and by gate score. Win rate and average R for trades with and without a sweep. Results by emotion before entry. Off-plan trades versus A+ trades.", "Insights → Patterns and Emotions shows these; the coach can summarise them in a weekly review."] },
      { h: "How to change", p: ["Change one rule per month, write the hypothesis, and measure it over at least 20–30 trades. Avoid strategy hopping after normal losing streaks — at a 35% win rate, eight losses in a row will happen eventually."] },
    ],
    example: { title: "One finding", text: ["Your A+ trades in London: +0.6R average. In New York after 09:30: −0.2R.", "Refinement: end the New York window at 09:30 for a month, then compare."] },
    takeaways: ["Let the data pick the change.", "One rule per month.", "20–30 trades before judging.", "Streaks are statistics, not signals."],
    sources: [40, 41],
  },
];

export const lessonsFor = (p: Path) => LESSONS.filter((l) => l.path === p);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null;

const KEY = "aplus.academy.done";
export function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
export function saveDone(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* storage unavailable */
  }
}
