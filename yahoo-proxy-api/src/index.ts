export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ticker = url.searchParams.get("ticker");
    const range = url.searchParams.get("range");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    // ✅ Accept either range OR (from + to)
    if (!ticker || (!range && (!from || !to))) {
      return new Response(JSON.stringify({ error: "Missing query params" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const targetUrl = range
      ? `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}&events=div`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${from}&period2=${to}&events=div`;

    try {
      const yahooRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (!yahooRes.ok) {
        const errorText = await yahooRes.text();
        return new Response(JSON.stringify({ error: "Yahoo API error", detail: errorText }), {
          status: yahooRes.status,
          headers: corsHeaders,
        });
      }

      const data = await yahooRes.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Fetch failed", detail: String(err) }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
