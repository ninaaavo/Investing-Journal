const BASE_URL = "https://yahoo-proxy-api.nina-vo.workers.dev";

/**
 * Normalize input to "YYYY-MM-DD" string
 * Accepts either a Date object or string
 */
function normalizeDateInput(input) {
  if (input instanceof Date) {
    return input.toISOString().split("T")[0];
  }
  return input;
}

/**
 * Converts "YYYY-MM-DD" string to a UTC Date object
 */
function parseDateStrAsUTC(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Fetches historical close prices and dividends for multiple tickers over a date range
 * @param {string[]} tickers
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @returns {Promise<Record<string, { priceMap: Record<string, number>, dividendMap: Record<string, number> }>>}
 */
export default async function fetchHistoricalPrices(tickers, startDate, endDate) {
  const result = {};

  const startDateStr = normalizeDateInput(startDate);
  const endDateStr = normalizeDateInput(endDate);

  const period1 = Math.floor(parseDateStrAsUTC(startDateStr).getTime() / 1000);
  const period2 = Math.floor(
    new Date(Date.UTC(...endDateStr.split("-").map(Number), 23, 59, 59, 999)).getTime() / 1000
  );

  for (const ticker of tickers) {
    const url = `${BASE_URL}?ticker=${ticker}&from=${period1}&to=${period2}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const r = data?.chart?.result?.[0];

      const timestamps = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const dividends = r?.events?.dividends ?? {};

      const priceMap = {};
      const dividendMap = {};

      for (let i = 0; i < timestamps.length; i++) {
        const dateStr = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
        priceMap[dateStr] = closes[i];
      }

      for (const key in dividends) {
        const dateStr = new Date(dividends[key].date * 1000).toISOString().split("T")[0];
        dividendMap[dateStr] = dividends[key].amount;
      }

      result[ticker] = { priceMap, dividendMap };
    } catch (err) {
      console.error(`❌ Failed to fetch for ${ticker}`, err);
      result[ticker] = { priceMap: {}, dividendMap: {} };
    }
  }

  return result;
}
