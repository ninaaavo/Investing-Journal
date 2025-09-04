// PLTimelineCard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import { useUser } from "../../../context/UserContext";
import { db } from "../../../firebase";
import { collection, onSnapshot, query, orderBy, limit, documentId } from "firebase/firestore";

const fmtUSD = (n) =>
  (Number(n) || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const parseISO = (s) => {
  const [y, m, d] = (s || "").split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  const t = new Date(s);
  return isNaN(t) ? new Date() : t;
};

const getUnrealized = (totals) => {
  const t = totals || {};
  if (t.unrealizedPLNet !== undefined) return Number(t.unrealizedPLNet) || 0;
  return (Number(t.unrealizedPLLong) || 0) + (Number(t.unrealizedPLShort) || 0);
};
const getRealized = (totals) => Number(totals?.realizedPL) || 0;

const TIMEFRAMES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1Y", days: 365 },
  { key: "All", days: Infinity },
];

const PLTimelineCard = () => {
  const { user } = useUser();
  const [raw, setRaw] = useState([]);
  const [ready, setReady] = useState(false);
  const [tf, setTf] = useState("3M");

  useEffect(() => {
    if (!user) return;
    const col = collection(db, "users", user.uid, "dailySnapshots");
    const q = query(col, orderBy(documentId(), "asc"), limit(1500));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((doc) => {
          const id = doc.id; // "YYYY-MM-DD"
          const d = doc.data() || {};
          const totals = d.totals || {};
          const unrl = getUnrealized(totals);
          const rlzd = getRealized(totals);
          rows.push({ id, date: parseISO(id), realized: rlzd, unrealized: unrl, total: rlzd + unrl });
        });
        setRaw(rows);
        setReady(true);
      },
      (err) => {
        console.error("dailySnapshots onSnapshot error", err);
        setRaw([]);
        setReady(true);
      }
    );
    return () => unsub?.();
  }, [user]);

  const data = useMemo(() => {
    if (!raw.length) return [];
    const days = TIMEFRAMES.find((t) => t.key === tf)?.days ?? Infinity;
    if (!isFinite(days)) return raw.map((r) => ({ ...r, x: r.id }));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return raw.filter((r) => r.date >= cutoff).map((r) => ({ ...r, x: r.id }));
  }, [raw, tf]);

  // ✅ single, correct Y-domain memo
  const yDomain = useMemo(() => {
    if (!data.length) return [0, 0];
    let minV = Infinity;
    let maxV = -Infinity;
    for (const d of data) {
      if (d.total < minV) minV = d.total;
      if (d.total > maxV) maxV = d.total;
    }
    if (minV === maxV) {
      minV -= 100;
      maxV += 100;
    } else {
      const pad = (maxV - minV) * 0.1;
      minV -= pad;
      maxV += pad;
    }
    return [Math.floor(minV), Math.ceil(maxV)];
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      layout
      className="w-full bg-white rounded-xl shadow-md p-4"
      style={{ height: 320 }}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">P/L Over Time</h2>
        <div className="flex gap-1">
          {TIMEFRAMES.map(({ key }) => (
            <button
              key={key}
              onClick={() => setTf(key)}
              className={`px-2 py-1 text-sm rounded-md ${
                tf === key ? "bg-neutral-900 text-white" : "bg-neutral-100 hover:bg-neutral-200"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {ready ? (
        data.length ? (
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="plFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" tick={{ fontSize: 12 }} tickMargin={8} minTickGap={16} />
              <YAxis tickFormatter={fmtUSD} domain={yDomain} width={70} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v, name) => [fmtUSD(v), name === "total" ? "Total P/L" : name]}
                labelFormatter={(l) => `Date: ${l}`}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Total P/L"
                stroke="#166534"
                fill="url(#plFill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[90%] flex items-center justify-center text-sm text-neutral-500">
            No snapshots yet.
          </div>
        )
      ) : (
        <div className="w-full h-[90%]" />
      )}

      <div className="mt-2 text-xs text-neutral-600">
        Total P/L = realizedPL + unrealizedPL (from each daily snapshot)
      </div>
    </motion.div>
  );
};

export default PLTimelineCard;
