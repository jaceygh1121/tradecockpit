// /api/tasty.js — Fetches positions and balances from Tastytrade
// Uses direct REST API calls (no SDK dependency)

const TASTY_API = "https://api.tastyworks.com";

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch(`${TASTY_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token || data.data?.["access-token"];
}

async function tastyFetch(path, token) {
  const res = await fetch(`${TASTY_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  // Verify auth token
  const authHeader = req.headers.authorization;
  const expectedToken = Buffer.from(
    (process.env.DASHBOARD_PASSWORD || "") + "_tradecockpit_auth"
  ).toString("base64");
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const clientId = process.env.TASTY_CLIENT_ID;
  const clientSecret = process.env.TASTY_CLIENT_SECRET;
  const refreshToken = process.env.TASTY_REFRESH_TOKEN;

  if (!clientSecret || !refreshToken) {
    return res.status(500).json({
      error: "Tastytrade credentials not configured",
      hint: "Add TASTY_CLIENT_SECRET and TASTY_REFRESH_TOKEN to Vercel env vars",
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
    });
  }

  try {
    // Step 1: Get access token using refresh token
    const accessToken = await getAccessToken(
      clientId,
      clientSecret,
      refreshToken
    );

    // Step 2: Get customer accounts
    const customerData = await tastyFetch("/customers/me/accounts", accessToken);
    const accounts = customerData.data?.items || [];

    const result = { accounts: [] };

    for (const acctWrapper of accounts) {
      const acct = acctWrapper.account || acctWrapper;
      const accountNumber = acct["account-number"];
      const accountName =
        acct.nickname || acct["account-type-name"] || accountNumber;

      // Get balances
      let balance = null;
      try {
        const balData = await tastyFetch(
          `/accounts/${accountNumber}/balances`,
          accessToken
        );
        const b = balData.data || {};
        balance = {
          cashBalance: parseFloat(b["cash-balance"] || 0),
          netLiq: parseFloat(b["net-liquidating-value"] || 0),
          equityValue: parseFloat(b["equity-value"] || 0),
        };
      } catch (e) {
        console.error(`Balance error for ${accountNumber}:`, e.message);
      }

      // Get positions
      let positions = [];
      try {
        const posData = await tastyFetch(
          `/accounts/${accountNumber}/positions`,
          accessToken
        );
        const items = posData.data?.items || [];
        positions = items
          .filter(
            (p) =>
              p["instrument-type"] === "Equity" &&
              parseFloat(p.quantity) > 0 &&
              p["quantity-direction"] === "Long"
          )
          .map((p) => ({
            ticker: p.symbol || p["underlying-symbol"],
            shares: parseFloat(p.quantity),
            averageOpenPrice: parseFloat(p["average-open-price"] || 0),
            currentPrice: parseFloat(p["close-price"] || 0),
            createdAt: p["created-at"],
          }));
      } catch (e) {
        console.error(`Position error for ${accountNumber}:`, e.message);
      }

      result.accounts.push({ accountNumber, accountName, balance, positions });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Tastytrade Error:", error.message);
    res.status(500).json({
      error: "Failed to connect to Tastytrade",
      message: error.message,
    });
  }
}
