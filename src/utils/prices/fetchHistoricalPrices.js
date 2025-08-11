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
export default async function fetchHistoricalPrices(tickers, startDate, endDate) {
  console.log("im fetching", tickers, "from", startDate, "to", endDate)
  const result = {};
  const startDateStr = normalizeDateInput(startDate);
  const endDateStr = normalizeDateInput(endDate);

  const start = parseDateStrAsUTC(startDateStr);
  const end = parseDateStrAsUTC(endDateStr);
  const rangeDays = getDaysDiff(start, new Date()); // from start to today (for Yahoo "range")
  const rangeParam = `${Math.max(1, rangeDays)}d`;

  for (const ticker of tickers) {
    const url = `${BASE_URL}?ticker=${encodeURIComponent(ticker)}&range=${rangeParam}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const r = data?.chart?.result?.[0];

      const timestamps = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const dividends = r?.events?.dividends ?? {};

      // Build base price map from Yahoo candles
      const priceMap = {};
      for (let i = 0; i < timestamps.length; i++) {
        const dateStr = formatDate(new Date(timestamps[i] * 1000)); // "YYYY-MM-DD"
        // Only keep points up to end (we'll fill the rest)
        if (dateStr <= endDateStr) {
          priceMap[dateStr] = closes[i];
        }
      }

      // ---- Fill missing days from the nearest prior known trading day ----
      const onePastEnd = addOneDay(end);
      let current = new Date(start);

      // Seed lastKnownPrice with the latest known date <= startDate
      let lastKnownPrice = null;
      const knownDates = Object.keys(priceMap).sort(); // lexicographic works for YYYY-MM-DD
      if (knownDates.length) {
        for (let i = knownDates.length - 1; i >= 0; i--) {
          if (knownDates[i] <= startDateStr) {
            lastKnownPrice = priceMap[knownDates[i]];
            break;
          }
        }
      }

      // Walk forward day-by-day, filling gaps with lastKnownPrice
      while (current < onePastEnd) {
        const dateStr = formatDate(current);

        if (priceMap[dateStr] == null) {
          if (lastKnownPrice != null) {
            priceMap[dateStr] = lastKnownPrice; // weekend/holiday gets prior trading day's close
          }
          // else: no earlier data exists yet; leave undefined until we hit a real data day
        } else {
          // Update seed whenever we hit a real trading day
          lastKnownPrice = priceMap[dateStr];
        }

        current = addOneDay(current);
      }

      // Build dividend map (keyed by YYYY-MM-DD)
      const dividendMap = {};
      for (const k in dividends) {
        const dStr = formatDate(new Date(dividends[k].date * 1000));
        dividendMap[dStr] = dividends[k].amount;
      }

      result[ticker] = { priceMap, dividendMap };
    } catch (err) {
      console.error(`❌ Failed to fetch for ${ticker}`, err);
      result[ticker] = { priceMap: {}, dividendMap: {} };
    }
  }

  return result;
}
