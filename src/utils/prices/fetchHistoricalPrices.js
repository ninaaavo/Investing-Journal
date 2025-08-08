const BASE_URL = "https://yahoo-proxy-api.nina-vo.workers.dev";

// Normalize input to "YYYY-MM-DD"
function normalizeDateInput(input) {
  if (input instanceof Date) return input.toISOString().split("T")[0];
  return input;
}

// Convert date string to UTC Date
function parseDateStrAsUTC(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Format Date to "YYYY-MM-DD"
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// Add one day to a UTC Date
function addOneDay(date) {
  const newDate = new Date(date);
  newDate.setUTCDate(newDate.getUTCDate() + 1);
  return newDate;
}

// Get days between two UTC dates
function getDaysDiff(start, end) {
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Main fetch function
export default async function fetchHistoricalPrices(
  tickers,
  startDate,
  endDate
) {
  const result = {};
  const startDateStr = normalizeDateInput(startDate);
  const endDateStr = normalizeDateInput(endDate);

  const start = parseDateStrAsUTC(startDateStr);
  const end = parseDateStrAsUTC(endDateStr);
  const rangeDays = getDaysDiff(start, new Date()); // from start to today
  const rangeParam = `${rangeDays}d`;

  for (const ticker of tickers) {
    const url = `${BASE_URL}?ticker=${ticker}&range=${rangeParam}`;
    // console.log("url is", url);

    try {
      const res = await fetch(url);
      const data = await res.json();
      const r = data?.chart?.result?.[0];

      const timestamps = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const dividends = r?.events?.dividends ?? {};

      const priceMap = {};
      const dividendMap = {};

      // Build base price map
      for (let i = 0; i < timestamps.length; i++) {
        const dateStr = formatDate(new Date(timestamps[i] * 1000));
        priceMap[dateStr] = closes[i];
      }

      // Fill missing dates with last known price
      const onePastEnd = addOneDay(end);
      let current = new Date(start);
      let lastKnownPrice = null;

      while (current < onePastEnd) {
        const dateStr = formatDate(current);

        if (priceMap[dateStr] == null && lastKnownPrice != null) {
          priceMap[dateStr] = lastKnownPrice;
        } else if (priceMap[dateStr] != null) {
          lastKnownPrice = priceMap[dateStr];
        }

        current = addOneDay(current);
      }

      // Build dividend map
      for (const key in dividends) {
        const dateStr = formatDate(new Date(dividends[key].date * 1000));
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
