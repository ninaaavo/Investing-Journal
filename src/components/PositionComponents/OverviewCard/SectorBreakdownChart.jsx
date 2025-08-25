// SectorBreakdownChart.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  Cell,
} from "recharts";
import { useUser } from "../../../context/UserContext";
import { db } from "../../../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { recalcSectorBreakdownAndSave } from "../../../utils/getSectorBreakdownData";
import { motion } from "framer-motion";

const SectorBreakdownChart = () => {
  const { user } = useUser();
  const [data, setData] = useState([]);
  const [ready, setReady] = useState(false); // <-- only mount chart when data is ready

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "stats", "sectorBreakdown");
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const arr = Array.isArray(d?.breakdown) ? d.breakdown : [];
        setData(arr);
        setReady(true); // first dataset ready
      } else {
        try {
          const fresh = await recalcSectorBreakdownAndSave(user.uid);
          setData(Array.isArray(fresh) ? fresh : []);
        } catch (err) {
          console.error("Failed to recalc sector breakdown", err);
          setData([]);
        } finally {
          setReady(true); // even if empty, mount without animation
        }
      }
    });
    return () => unsub?.();
  }, [user]);

  const hasData = data && data.length > 0;
  const values = hasData ? data.map((d) => Number(d.value) || 0) : [0];
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  const getGreenShade = (value) => {
    const darkGreen = [68, 108, 87];
    const lightGreen = [107, 173, 110];

    if (maxValue === minValue) {
      const mid = [
        Math.floor((darkGreen[0] + lightGreen[0]) / 2),
        Math.floor((darkGreen[1] + lightGreen[1]) / 2),
        Math.floor((darkGreen[2] + lightGreen[2]) / 2),
      ];
      return `rgb(${mid[0]}, ${mid[1]}, ${mid[2]})`;
    }

    const ratio = (Number(value || 0) - minValue) / (maxValue - minValue);
    const r = Math.floor(lightGreen[0] + (darkGreen[0] - lightGreen[0]) * ratio);
    const g = Math.floor(lightGreen[1] + (darkGreen[1] - lightGreen[1]) * ratio);
    const b = Math.floor(lightGreen[2] + (darkGreen[2] - lightGreen[2]) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const effectiveCutoff = useMemo(() => {
    if (!hasData) return 0;
    const idx = data.findIndex((d) => d.name.length * 6.5 + 8 > d.value * 5);
    return idx === -1 ? data.length : idx;
  }, [data, hasData]);

  const chartHeight = (data?.length || 0) * 60 + 40;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      layout
      className="w-full bg-white rounded-xl shadow-md p-4"
      style={{ height: `${chartHeight}px` }}
    >
      <h2 className="text-lg font-semibold mb-2">Sector Breakdown</h2>

      {/* Mount BarChart only when data is ready to avoid first-load grow animation */}
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            barSize={60}
            margin={{ top: 10, bottom: 20, right: 30, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}`} />
            <YAxis type="category" dataKey="name" tick={false} width={0} />
            <Tooltip formatter={(value) => `${value}%`} isAnimationActive={false} />

            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}       // hard-disable bar animation
              animationDuration={0}           // extra belt-and-suspenders
              animationBegin={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getGreenShade(entry.value)} />
              ))}

              <LabelList
                dataKey="name"
                isAnimationActive={false}      // disable label animation
                content={({ x, y, width, height, index }) => {
                  if (!data[index]) return null;
                  const barValue = Number(data[index].value) || 0;
                  const label = data[index].name;
                  const shouldShowOutside = index >= effectiveCutoff;
                  const labelX = x + 10;
                  const percentX = x + width + 10;
                  const fill = shouldShowOutside ? "#333" : "#fff";

                  return (
                    <>
                      {!shouldShowOutside && (
                        <text
                          x={labelX}
                          y={y + height / 2}
                          fill={fill}
                          fontSize={12}
                          alignmentBaseline="middle"
                        >
                          {label}
                        </text>
                      )}
                      <text
                        x={percentX}
                        y={y + height / 2}
                        fill="#333"
                        fontSize={12}
                        alignmentBaseline="middle"
                      >
                        {shouldShowOutside ? `${label}: ${barValue}%` : `${barValue}%`}
                      </text>
                    </>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        // keep layout height stable while waiting (no chart mounted yet)
        <div className="w-full h-full" />
      )}
    </motion.div>
  );
};

export default SectorBreakdownChart;
