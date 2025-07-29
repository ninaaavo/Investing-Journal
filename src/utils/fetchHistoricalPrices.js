export async function fetchHistoricalPrices(tickers, date) {
  const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  const results = {};
  for (const ticker of tickers) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${Math.floor(
          date.getTime() / 1000
        )}&to=${Math.floor(date.getTime() / 1000)}&token=${API_KEY}`
      );
      const data = await res.json();
      results[ticker] = data?.c?.[0] ?? 0;
    } catch (err) {
      console.error(`Failed to fetch for ${ticker}`, err);
      results[ticker] = 0;
    }
  }

  return results;
}
