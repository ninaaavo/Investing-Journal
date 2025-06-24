import React, { useEffect } from "react";

export default function RiskRewardInput({ form, setForm }) {
  const isTargetMode = form.rrInputMode === "targetPrice";

  // 🔁 Recalculate derived value on entryPrice or stopLoss change
  useEffect(() => {
    if (!form.entryPrice || !form.stopLoss) return;

    if (isTargetMode) {
      const rr =
        ((form.targetPrice - form.entryPrice) / (form.entryPrice - form.stopLoss)).toFixed(2);
      if (rr !== form.riskReward) {
        setForm((prev) => ({ ...prev, riskReward: rr }));
      }
    } else {
      const tp =
        (+form.entryPrice + (+form.entryPrice - +form.stopLoss) * form.riskReward).toFixed(2);
      if (tp !== form.targetPrice) {
        setForm((prev) => ({ ...prev, targetPrice: tp }));
      }
    }
  }, [form.entryPrice, form.stopLoss, form.rrInputMode, form.targetPrice, form.riskReward, isTargetMode, setForm]);

  const handleChange = (e) => {
    const value = e.target.value;
    if (isTargetMode) {
      const rr =
        form.entryPrice && form.stopLoss
          ? ((value - form.entryPrice) / (form.entryPrice - form.stopLoss)).toFixed(2)
          : "";
      setForm({ ...form, targetPrice: value, riskReward: rr });
    } else {
      const tp =
        form.entryPrice && form.stopLoss
          ? (+form.entryPrice + (+form.entryPrice - +form.stopLoss) * value).toFixed(2)
          : "";
      setForm({ ...form, riskReward: value, targetPrice: tp });
    }
  };

  const handleSwap = () => {
    setForm((prev) => ({
      ...prev,
      rrInputMode: isTargetMode ? "riskReward" : "targetPrice",
    }));
  };

  const label = isTargetMode ? "Target Price" : "R/R Ratio";
  const outputLabel = isTargetMode ? "R/R Ratio" : "Target Price";
  const outputValue = isTargetMode ? form.riskReward : form.targetPrice;

  return (
    <div className="flex flex-col w-full">
      {/* Label + Swap Button */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium">{label}</span>
        <button
          type="button"
          onClick={handleSwap}
          className="text-sm hover:opacity-70 active:opacity-100"
          title="Swap input mode"
        >
          ⇄
        </button>
      </div>

      {/* Editable Input */}
      <input
        type="number"
        name={form.rrInputMode}
        value={form[form.rrInputMode]}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />

      {/* Read-only calculated result */}
      {form.entryPrice && form.stopLoss && outputValue && (
        <p className="text-xs text-gray-500 pl-1 mt-1">
          {outputLabel} = {outputValue}
        </p>
      )}
    </div>
  );
}
