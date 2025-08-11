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
import { getSectorBreakdownData } from "../../../utils/getSectorBreakdownData";
import { useUser } from "../../../context/UserContext";

const SectorBreakdownChart = () => {
  const { user, refreshTrigger } = useUser();
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const breakdown = await getSectorBreakdownData(user.uid);
      setData(Array.isArray(breakdown) ? breakdown : []);
    };
    fetchData();
  }, [user, refreshTrigger]);

  // Basic guards and shared numbers
  const hasData = data && data.length > 0;
  const values = hasData ? data.map(d => Number(d.value) || 0) : [0];
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  // Color scale with single-item guard
  const getGreenShade = (value) => {
    const darkGreen = [68, 108, 87];   // #446C57
    const lightGreen = [107, 173, 110]; // #6BAD6E

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

  // Decide when to push the name outside the bar
  const effectiveCutoff = useMemo(() => {
    if (!hasData) return 0;
    const idx = data.findIndex((d) => d.name.length * 6.5 + 8 > d.value * 5);
    return idx === -1 ? data.length : idx;
  }, [data, hasData]);

  const chartHeight = (data?.length || 0) * 60 + 40;

  return (
    <div
      className="w-full bg-white rounded-xl shadow-md p-4"
      style={{ height: `${chartHeight}px` }}
    >
      <h2 className="text-lg font-semibold mb-2">Sector Breakdown</h2>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          barSize={60}
          margin={{ top: 10, bottom: 20, right: 30, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          {/* Cap to 0..100 so 100% doesn't create a 110% axis */}
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}`}
          />
          <YAxis type="category" dataKey="name" tick={false} width={0} />

          <Tooltip formatter={(value) => `${value}%`} />

          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getGreenShade(entry.value)} />
            ))}

            <LabelList
              dataKey="name"
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
    </div>
  );
};

export default SectorBreakdownChart;
