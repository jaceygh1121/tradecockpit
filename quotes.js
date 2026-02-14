// /api/quotes.js — Fetches live market data
// Uses Yahoo Finance (free, no API key required)

export default async function handler(req, res) {
  const { tickers } = req.query;

  if (!tickers) {
    return res.status(400).json({ error: "No tickers provided" });
  }

  const tickerList = tickers.split(",").map((t) => t.trim().toUpperCase());
  const results = {};

  try {
    // Fetch all tickers in one call using Yahoo Finance v8 API
    const symbols = tickerList.join(",");
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols}&range=1mo&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    // Also fetch quote data for day change, volume, name
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    let sparkData = null;
    let quoteData = null;

    try {
      sparkData = await response.json();
    } catch (e) {
      console.error("Spark parse error:", e);
    }

    try {
      quoteData = await quoteResponse.json();
    } catch (e) {
      console.error("Quote parse error:", e);
    }

    // Process quote data
    const quoteMap = {};
    if (quoteData?.quoteResponse?.result) {
      for (const q of quoteData.quoteResponse.result) {
        quoteMap[q.symbol] = {
          price: q.regularMarketPrice || 0,
          dayChange: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          avgVolume: q.averageDailyVolume10Day || q.averageDailyVolume3Month || 1,
          name: q.shortName || q.longName || q.symbol,
          marketCap: q.marketCap || 0,
        };
      }
    }

    // Process spark data for SMA calculation
    if (sparkData?.spark?.result) {
      for (const item of sparkData.spark.result) {
        const symbol = item.symbol;
        const closes = item.response?.[0]?.indicators?.quote?.[0]?.close || [];
        const validCloses = closes.filter((c) => c !== null);

        // Calculate 10-day SMA from recent closes
        const recent10 = validCloses.slice(-10);
        const sma10 =
          recent10.length > 0
            ? recent10.reduce((s, c) => s + c, 0) / recent10.length
            : null;

        const quoteInfo = quoteMap[symbol] || {};
        results[symbol] = {
          price: quoteInfo.price || validCloses[validCloses.length - 1] || 0,
          sma10: sma10,
          name: quoteInfo.name || symbol,
          dayChange: quoteInfo.dayChange || 0,
          rvol:
            quoteInfo.avgVolume > 0
              ? parseFloat((quoteInfo.volume / quoteInfo.avgVolume).toFixed(2))
              : 1.0,
          volume: quoteInfo.volume || 0,
          avgVolume: quoteInfo.avgVolume || 0,
        };
      }
    }

    // Fill in any tickers that spark didn't return but quote did
    for (const ticker of tickerList) {
      if (!results[ticker] && quoteMap[ticker]) {
        results[ticker] = {
          price: quoteMap[ticker].price,
          sma10: null,
          name: quoteMap[ticker].name,
          dayChange: quoteMap[ticker].dayChange,
          rvol:
            quoteMap[ticker].avgVolume > 0
              ? parseFloat(
                  (
                    quoteMap[ticker].volume / quoteMap[ticker].avgVolume
                  ).toFixed(2)
                )
              : 1.0,
          volume: quoteMap[ticker].volume,
          avgVolume: quoteMap[ticker].avgVolume,
        };
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("API Error:", error);
    // Return fallback with whatever we have
    res.status(200).json(results);
  }
}
