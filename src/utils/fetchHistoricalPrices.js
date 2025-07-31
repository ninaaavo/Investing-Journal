export async function fetchHistoricalPrices(tickers, date) {
  const maxLookback = 10; // Avoid infinite loops
  let attempts = 0;

  while (attempts < maxLookback) {
    const dateStr = date.toISOString().split("T")[0];
    const period1 = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${dateStr}T23:59:59Z`).getTime() / 1000);

    const allPrices = {};

    for (const ticker of tickers) {
      try {
        const url = `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/yahooPriceProxy?ticker=${ticker}&from=${period1}&to=${period2}`;
        const res = await fetch(url);
        const data = await res.json();

        const close = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.[0];
        allPrices[ticker] = close ?? 0;
      } catch (err) {
        console.error(`Failed to fetch Yahoo price for ${ticker} on ${dateStr}:`, err);
        allPrices[ticker] = 0;
      }
    }

    const allValid = Object.values(allPrices).every((price) => price > 0);
    if (allValid) return allPrices;

    // Go back 1 day and try again
    date.setDate(date.getDate() - 1);
    attempts++;
  }

  // As fallback, return 0s
  return tickers.reduce((acc, ticker) => ({ ...acc, [ticker]: 0 }), {});
}
