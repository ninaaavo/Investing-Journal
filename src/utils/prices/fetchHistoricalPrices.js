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

// Main fetch function
export default async function fetchHistoricalPrices(
  tickers,
  startDate,
  endDate
) {
  console.log("fetch ", tickers, "start", startDate, "end", endDate)
  const result = {};
  const startDateStr = normalizeDateInput(startDate);
  const endDateStr = normalizeDateInput(endDate);
  const period1 = Math.floor(parseDateStrAsUTC(startDateStr).getTime() / 1000);
  const period2 = Math.floor(
    new Date(
      Date.UTC(...endDateStr.split("-").map(Number), 23, 59, 59, 999)
    ).getTime() / 1000
  );
  console.log("start str", startDateStr, "end st", endDateStr)
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

      // Build base price map
      for (let i = 0; i < timestamps.length; i++) {
        const dateStr = formatDate(new Date(timestamps[i] * 1000));
        priceMap[dateStr] = closes[i];
      }
      console.log("you base price map is", priceMap);

      // Fill missing dates with last known price
      const start = parseDateStrAsUTC(startDateStr);
      const end = addOneDay(parseDateStrAsUTC(endDateStr)); // ✅ include endDate

      let current = new Date(start);
      let lastKnownPrice = null;

      while (current < end) {
        // ✅ no longer `<=`, since `end` is one day after real end
        const dateStr = formatDate(current);
        console.log("on date", dateStr);

        if (priceMap[dateStr] == null && lastKnownPrice != null) {
          console.log("im null, getting lastknown", lastKnownPrice);
          priceMap[dateStr] = lastKnownPrice;
        } else if (priceMap[dateStr] != null) {
          lastKnownPrice = priceMap[dateStr];
        }

        current = addOneDay(current);
        console.log("current is", current)
        console.log("end date is", end)
      }
      console.log("end map", priceMap)

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
