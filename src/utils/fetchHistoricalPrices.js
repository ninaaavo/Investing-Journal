export async function fetchHistoricalPrices(tickers, date) {
  const results = {};
  const dateStr = date.toISOString().split("T")[0];
  const period1 = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
  const period2 = Math.floor(new Date(dateStr + "T23:59:59Z").getTime() / 1000);

  for (const ticker of tickers) {
    try {
      const url = `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/yahooPriceProxy?ticker=${ticker}&from=${period1}&to=${period2}`;
      const res = await fetch(url);
      const data = await res.json();

      const result = data.chart?.result?.[0];
      const close = result?.indicators?.quote?.[0]?.close?.[0];
      results[ticker] = close ?? 0;
    } catch (err) {
      console.error(`Failed to fetch Yahoo price for ${ticker}:`, err);
      results[ticker] = 0;
    }
  }

  return results;
}
