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
 *  - ticker (string, required)
 *  - entryDateISO (YYYY-MM-DD, required)
 *  - exitDateISO  (YYYY-MM-DD, optional)
 *  - exitEvents   (array, optional) // [{ exitTimestamp, sharesSold, soldPrice }]
 *  - showEntryDot (bool, default true)
 *  - height       (number, default 240)
 */
export default function StockPriceChart({
  ticker,
  entryDateISO,
  exitDateISO,
  exitEvents = [],
  showEntryDot = true,
  height = 240,
}) {
  const { user } = useUser();

  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(false);

  // Normalize sell events to ET dates & numbers
  const normalizedSells = useMemo(() => {
    return (exitEvents || []).map((e) => ({
      date: toETDateOnly(e.exitTimestamp),
      sharesSold: Number(e.sharesSold ?? 0),
      soldPrice: Number(e.soldPrice ?? 0),
    }));
  }, [exitEvents]);

  // Fetch price series spanning entry -> (optional) exit
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!user?.uid || !ticker || !entryDateISO) return;
      setLoading(true);
      const s = await fetchTickerPriceSeries({
        uid: user.uid,
        ticker,
        startDateISO: entryDateISO,
        endDateISO: exitDateISO || null,
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
  }, [user?.uid, ticker, entryDateISO, exitDateISO]);

  // Lookups
  const seriesByDate = useMemo(() => {
    const m = new Map();
    for (const row of series || []) m.set(row.date, row);
    return m;
  }, [series]);

  const entryY = useMemo(() => seriesByDate.get(entryDateISO)?.close, [seriesByDate, entryDateISO]);

  // Only keep sell events whose dates exist in the X domain (series)
  const sellRefs = useMemo(() => {
    if (!series) return [];
    return normalizedSells.filter((ev) => seriesByDate.has(ev.date));
  }, [normalizedSells, series, seriesByDate]);

  if (!ticker || !entryDateISO) return <Placeholder>Missing ticker/entry date</Placeholder>;
  if (loading || !series) return <Placeholder>Loading chart…</Placeholder>;
  if (series.length === 0) return <Placeholder>No price data found for {ticker}</Placeholder>;

  return (
    <div className="w-full rounded-xl border bg-white">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} width={56} domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltip sells={sellRefs} />} />
            {/* PRICE LINE (close) */}
            <Line type="monotone" dataKey="close" dot={false} strokeWidth={2} name="Close" />

            {/* ENTRY DOT (optional) at entry date's close */}
            {showEntryDot && typeof entryY === "number" && (
              <ReferenceDot x={entryDateISO} y={entryY} r={4} isFront />
            )}

            {/* SELL DOTS at exact sold price on sell date(s) */}
            {sellRefs.map((ev, i) => (
              <ReferenceDot
                key={`${ev.date}-${i}`}
                x={ev.date}               // categorical X matches series date
                y={ev.soldPrice}          // exact sold price (e.g., 333)
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

function Placeholder({ children }) {
  return (
    <div className="w-full rounded-xl border bg-gray-50 h-[240px] flex items-center justify-center text-sm text-gray-500">
      {children || "Chart"}
    </div>
  );
}

/** Tooltip shows close and any sells on the hovered date */
function ChartTooltip({ active, payload, label, sells }) {
  if (!active || !payload || payload.length === 0) return null;

  const closeRow = payload.find((p) => p.name === "Close");
  const closeVal = closeRow ? Number(closeRow.value) : null;

  const sellsToday = (sells || []).filter((s) => s.date === label);

  return (
    <div className="rounded-lg border bg-white p-2 text-xs shadow">
      <div className="font-medium mb-1">Date: {label}</div>
      {closeVal != null && <div>Close: ${closeVal.toFixed(2)}</div>}
      {sellsToday.length > 0 && (
        <div className="mt-1 space-y-1">
          {sellsToday.map((e, idx) => (
            <div key={idx}>
              Sell {e.sharesSold} {e.sharesSold === 1 ? "share" : "shares"} @ $
              {Number(e.soldPrice).toFixed(2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
