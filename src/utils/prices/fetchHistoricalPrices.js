const BASE_URL = "https://yahoo-proxy-api.nina-vo.workers.dev";

export default async  function fetchHistoricalPrices(tickers, initialDate) {
  const maxLookback = 10;
  const fetchedPrices = {};

  tickers.forEach((ticker) => {
    fetchedPrices[ticker] = 0; // default to 0
  });

  const date = new Date(initialDate); // clone so you don’t mutate original
  let attempts = 0;

  while (attempts < maxLookback) {
    const dateStr = date.toISOString().split("T")[0];
    const period1 = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${dateStr}T23:59:59Z`).getTime() / 1000);

    console.log(`🔍 Trying price lookup for ${dateStr}`);

    for (const ticker of tickers) {
      if (fetchedPrices[ticker] > 0) continue;

      try {
        const url = `${BASE_URL}?ticker=${ticker}&from=${period1}&to=${period2}`;
        const res = await fetch(url);
        const data = await res.json();

        const result = data.chart?.result?.[0];
        const close = result?.indicators?.quote?.[0]?.close?.[0];

        if (close != null && !isNaN(close)) {
          fetchedPrices[ticker] = close;
        }
      } catch (err) {
        console.error(`❌ Failed to fetch price for ${ticker} on ${dateStr}:`, err);
      }
    }

    const allFound = Object.values(fetchedPrices).every((p) => p > 0);
    if (allFound) break;

    // ⏪ Fallback: try previous date
    date.setDate(date.getDate() - 1);
    attempts++;
  }

  return fetchedPrices;
}
