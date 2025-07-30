export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ticker = url.searchParams.get("ticker");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!ticker || !from || !to) {
      return new Response(JSON.stringify({ error: "Missing query params" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${from}&period2=${to}`;

    try {
      const yahooRes = await fetch(targetUrl, {
        headers: {
          // This tricks Yahoo into thinking it's a real browser
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });

      const data = await yahooRes.json();

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to fetch" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
