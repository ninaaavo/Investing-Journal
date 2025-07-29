const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default async function getStockPrices(tickers) {
  if (!API_KEY) throw new Error("Finnhub API key is missing");

  const prices = {};

  // Limit concurrent requests (Finnhub has a rate limit)
  const fetchPrice = async (ticker) => {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`
      );
      const data = await res.json();
      if (data && data.c) {
        prices[ticker] = parseFloat(data.c); // "c" is current price
      } else {
        prices[ticker] = 0;
      }
    } catch (err) {
      console.error(`Failed to fetch price for ${ticker}:`, err);
      prices[ticker] = 0;
    }
  };

  await Promise.all(tickers.map(fetchPrice));
  return prices;
}
