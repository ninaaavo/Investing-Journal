import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { useUser } from "../../context/UserContext";
import { fetchTickerPriceSeries } from "../../utils/snapshot/fetchTickerPriceSeries";
import { toETDateOnly } from "../../utils/toETDateOnly";

/**
 * Props:
 *  - ticker         (string, required)
 *  - entryDateISO   (YYYY-MM-DD, required)   // first buy date
 *  - exitDateISO    (YYYY-MM-DD, optional)   // sell date (required if variant="exit")
 *  - exitEvents     (array, optional)        // [{ exitTimestamp, sharesSold, soldPrice }]
 *  - entryEvents    (array, optional)        // [{ entryTimestamp, sharesUsed|shares, entryPrice }]
 *  - variant        ("entry" | "exit", default "entry")
 *  - showEntryDot   (bool, default true)     // highlight first entry date's close
 *  - height         (number, default 240)
 *  - isLong         (boolean, default true)
 */
export default function StockPriceChart({
  ticker,
  entryDateISO,
  exitDateISO,
  exitEvents = [],
  entryEvents = [],
  variant = "entry",
  showEntryDot = true,
  height = 160,
  isLong = true,
}) {
  function Placeholder({ children }) {
    return (
      <div
        className="w-full rounded-xl border bg-gray-50 flex items-center justify-center text-sm text-gray-500"
        style={{ height: `calc(${height}px + 30px)` }}
      >
        {children || "Chart"}
      </div>
    );
  }
  const { user } = useUser();

  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(false);

  // Normalize EXIT sells for entry-mode dots (if used)
  const normalizedSells = useMemo(() => {
    return (exitEvents || []).map((e) => ({
      date: toETDateOnly(e.exitTimestamp),
      shares: Number(e.sharesSold ?? 0),
      price: Number(e.soldPrice ?? 0),
      kind: "sell",
    }));
  }, [exitEvents]);

  // Normalize ENTRY buys for exit-mode dots
  const normalizedBuys = useMemo(() => {
    return (entryEvents || []).map((e) => ({
      date: toETDateOnly(e.entryTimestamp),
      shares: Number(e.sharesUsed ?? e.shares ?? 0),
      price: Number(e.entryPrice ?? 0),
      kind: "buy",
    }));
  }, [entryEvents]);

  // Fetch price series across the correct window
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!user?.uid || !ticker || !entryDateISO) return;
      if (variant === "exit" && !exitDateISO) return;

      setLoading(true);
      const s = await fetchTickerPriceSeries({
        uid: user.uid,
        ticker,
        startDateISO: entryDateISO,
        endDateISO: variant === "exit" ? exitDateISO : exitDateISO || null,
        isLong
      });
      if (alive) {
        setSeries(s);
        setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [user?.uid, ticker, entryDateISO, exitDateISO, variant]);

  // Lookups
  const seriesByDate = useMemo(() => {
    const m = new Map();
    for (const row of series || []) m.set(row.date, row);
    return m;
  }, [series]);

  const entryY = useMemo(
    () =>
      seriesByDate.has(entryDateISO)
        ? seriesByDate.get(entryDateISO).close
        : undefined,
    [seriesByDate, entryDateISO]
  );

  // Choose which events to plot as dots
  const rawEventsForDots =
    variant === "exit" ? normalizedBuys : normalizedSells;

  // Keep only those events that fall on dates present in the series
  const eventDots = useMemo(() => {
    if (!series) return [];
    return rawEventsForDots.filter((ev) => seriesByDate.has(ev.date));
  }, [rawEventsForDots, series, seriesByDate]);

  if (!ticker || !entryDateISO)
    return <Placeholder>Missing ticker/entry date</Placeholder>;
  if (variant === "exit" && !exitDateISO)
    return <Placeholder>Missing sell date for exit chart</Placeholder>;
  if (loading || !series) return <Placeholder>Loading chart…</Placeholder>;
  if (series.length === 0)
    return <Placeholder>No price data found for {ticker}</Placeholder>;

  const tooltipMode = variant === "exit" ? "buy" : "sell";
  const title = variant === "exit" ? "Exit Price Chart" : "Entry Price Chart";
  console.log("im loading stock price, w events " + series);
  return (
    <div className="w-full rounded-xl border bg-white">
      <div className="px-3 pt-2 text-sm text-gray-600">{title}</div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart
            data={series}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={56}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={<ChartTooltip mode={tooltipMode} events={eventDots} />}
            />

            {/* PRICE LINE (close) */}
            <Line
              type="monotone"
              dataKey="close"
              dot={false}
              strokeWidth={2}
              name="Close"
            />

            {/* ENTRY DOT (optional) at first entry date's close */}
            {showEntryDot && typeof entryY === "number" && (
              <ReferenceDot x={entryDateISO} y={entryY} r={4} isFront />
            )}

            {/* EVENT DOTS */}
            {eventDots.map((ev, i) => (
              <ReferenceDot
                key={`${ev.kind}-${ev.date}-${i}`}
                x={ev.date}
                y={ev.price}
                r={4}
                isFront
                fill="currentColor"
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Tooltip shows close and BUY/SELL events on the hovered date */
function ChartTooltip({ active, payload, label, events, mode }) {
  if (!active || !payload || payload.length === 0) return null;

  const closeRow = payload.find((p) => p.name === "Close");
  const closeVal = closeRow ? Number(closeRow.value) : null;

  const eventsToday = (events || []).filter((e) => e.date === label);
  const verb = mode === "buy" ? "Buy" : "Sell";

  return (
    <div className="rounded-lg border bg-white p-2 text-xs shadow">
      <div className="font-medium mb-1">Date: {label}</div>
      {closeVal != null && <div>Close: ${closeVal.toFixed(2)}</div>}
      {eventsToday.length > 0 && (
        <div className="mt-1 space-y-1">
          {eventsToday.map((e, idx) => (
            <div key={idx}>
              {verb} {e.shares} {e.shares === 1 ? "share" : "shares"} @ $
              {Number(e.price).toFixed(2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
