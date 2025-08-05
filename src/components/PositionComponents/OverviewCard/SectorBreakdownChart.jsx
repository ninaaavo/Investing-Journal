import React, { useRef, useState, useEffect } from "react";
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
import { getSectorBreakdownData } from "../../../utils/getSectorBreakdownData"; // path adjusted to your structure
import { useUser } from "../../../context/UserContext";

const SectorBreakdownChart = () => {
  const { user, refreshTrigger } = useUser();
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const breakdown = await getSectorBreakdownData(user.uid);
      setData(breakdown);
    };

    fetchData();
  }, [user, refreshTrigger]);

  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));

  const getGreenShade = (value) => {
    const darkGreen = [68, 108, 87];
    const lightGreen = [107, 173, 110];
    const ratio = (value - minValue) / (maxValue - minValue);
    const r = Math.floor(
      lightGreen[0] + (darkGreen[0] - lightGreen[0]) * ratio
    );
    const g = Math.floor(
      lightGreen[1] + (darkGreen[1] - lightGreen[1]) * ratio
    );
    const b = Math.floor(
      lightGreen[2] + (darkGreen[2] - lightGreen[2]) * ratio
    );
    return `rgb(${r}, ${g}, ${b})`;
  };

  const cutoffIndex = data.findIndex(
    (d) => d.name.length * 6.5 + 8 > d.value * 5
  );
  const effectiveCutoff = cutoffIndex === -1 ? data.length : cutoffIndex;

  const DynamicNameLabel = ({ x, y, width, height, index }) => {
    const barValue = data[index].value;
    const label = data[index].name;
    const shouldShowOutside = index >= effectiveCutoff;
    const labelX = x + 5;
    const percentX = x + width + 5;
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
  };
const chartHeight = data.length * 60 + 40;

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
        barSize={60} // thinner bars with vertical spacing
        margin={{ top: 10, bottom: 20, right: 30, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 'dataMax + 10']} />
        <YAxis type="category" dataKey="name" tick={false} width={0} />
        <Tooltip formatter={(value) => `${value}%`} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getGreenShade(entry.value)} />
          ))}
          <LabelList
            dataKey="name"
            content={({ x, y, width, height, index }) => {
              const barValue = data[index].value;
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
