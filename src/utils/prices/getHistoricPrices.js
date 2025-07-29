const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

// Convert "YYYY-MM-DD" to UTC timestamps
function getUnixRange(dateStr) {
  const date = new Date(dateStr);
  const from = Math.floor(new Date(date.setHours(16, 0, 0, 0)).getTime() / 1000); // 4:00 PM UTC-ish
  const to = from + 60; // 1-minute window
  return { from, to };
}

export default async function getHistoricPrices(tickers, dateStr) {
  if (!API_KEY) throw new Error("Missing FINNHUB API key");

  const { from, to } = getUnixRange(dateStr);
  const prices = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.c && data.c.length > 0) {
          prices[ticker] = parseFloat(data.c[0]); // "c" = closing price
        } else {
          console.warn("No historical data for", ticker, "on", dateStr);
          prices[ticker] = 0;
        }
      } catch (err) {
        console.error("Error fetching historical price for", ticker, err);
        prices[ticker] = 0;
      }
    })
  );

  return prices;
}
