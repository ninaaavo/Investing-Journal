export default function StockCard() {

  return (
    <div className="p-8 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-fit text-sm">
        <div className="text-2xl font-medium">AAPL</div>
        <div>Apple Inc.</div>
        <div>Shares: 10</div>
        <div>Bought Price: $100</div>
        <div>Current Price: $120</div>
        <div>Last transaction: 1:23pm 5/23/2025</div>

    </div>
  );
}
