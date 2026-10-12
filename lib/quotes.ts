/**
 * Quote of the day + one playbook principle. Quotes are well-documented ones; "attributed" marks the
 * popular-but-loosely-sourced ones honestly. Rotates by IST day so it changes every morning.
 */
export type DailyQuote = { text: string; by: string; note?: string };

export const QUOTES: DailyQuote[] = [
  { text: "The elements of good trading are: (1) cutting losses, (2) cutting losses, and (3) cutting losses.", by: "Ed Seykota", note: "Market Wizards" },
  { text: "Win or lose, everybody gets what they want out of the market.", by: "Ed Seykota", note: "Market Wizards" },
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", by: "George Soros" },
  { text: "Risk comes from not knowing what you're doing.", by: "Warren Buffett" },
  { text: "Rule No. 1: Never lose money. Rule No. 2: Never forget rule No. 1.", by: "Warren Buffett" },
  { text: "The stock market is a device for transferring money from the impatient to the patient.", by: "Warren Buffett", note: "attributed" },
  { text: "The most important rule of trading is to play great defense, not great offense.", by: "Paul Tudor Jones" },
  { text: "It never was my thinking that made the big money for me. It always was my sitting.", by: "Reminiscences of a Stock Operator", note: "Edwin Lefèvre, 1923" },
  { text: "There is nothing new in Wall Street. There can't be because speculation is as old as the hills.", by: "Reminiscences of a Stock Operator", note: "Edwin Lefèvre, 1923" },
  { text: "There is a time to go long, a time to go short and a time to go fishing.", by: "Jesse Livermore", note: "attributed" },
  { text: "The four most dangerous words in investing are: 'this time it's different.'", by: "Sir John Templeton" },
  { text: "In investing, what is comfortable is rarely profitable.", by: "Robert Arnott" },
  { text: "Know what you own, and know why you own it.", by: "Peter Lynch" },
  { text: "Markets can remain irrational longer than you can remain solvent.", by: "John Maynard Keynes", note: "attributed" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Will Durant", note: "summarising Aristotle" },
  { text: "Discipline is the bridge between goals and accomplishment.", by: "Jim Rohn" },
  { text: "Every battle is won before it is fought.", by: "Sun Tzu", note: "attributed, The Art of War" },
  { text: "Plan the trade and trade the plan.", by: "Trading proverb" },
  { text: "Cut your losses short and let your profits run.", by: "David Ricardo", note: "attributed" },
  { text: "Amateurs think about how much money they can make. Professionals think about how much they could lose.", by: "Trading proverb" },
  { text: "The goal is not to trade often; the goal is to trade well.", by: "Trading proverb" },
];

/** One concrete, informative principle from the playbook for the day. */
export const PRINCIPLES: string[] = [
  "No sweep, no shift, no trade. The A+ gate is binary.",
  "Longs only in discount, shorts only in premium. Mid-range is a no-trade zone.",
  "Write the invalidation before the session: “bias is wrong if price closes and holds beyond ___”.",
  "The TP must be a real structural target ≥ 3R away. Never stretch it to make the maths work.",
  "Market shift = a 5M/1M body close beyond the last lower high (long) or higher low (short). Wicks don't count.",
  "If the shift leaves without a pullback, let it go. Chasing turns an A+ into a C.",
  "Nothing opens from 15 min before to 15 min after high-impact news — and the first hour after can still whip.",
  "After two losses, the day is done. Tomorrow's setups are better than today's revenge.",
  "Set alerts at your POIs and walk away. Price coming to you is the edge; you going to price is the leak.",
  "Breakeven win rate at 3R is 25%. You can be wrong most of the time and still pass.",
  "Gold sweeps a high or low and reverses hard: get in fast, get out faster.",
  "BTC stops trigger on mark price, and fees eat tight stops — keep the SL ≥ 0.4% of price.",
  "Judge the system on 100 trades, not on a day. Slowness is what passes challenges.",
  "Flip zone vs extreme zone? Prefer the extreme — liquidity under the flip usually gets taken first.",
];

export function quoteOfDay(istDate: string): { quote: DailyQuote; principle: string } {
  const day = Math.floor(Date.parse(`${istDate}T00:00:00Z`) / 86400000);
  return { quote: QUOTES[day % QUOTES.length], principle: PRINCIPLES[(day * 7) % PRINCIPLES.length] };
}
