// /api/tasty.js — Fetches positions and balances from Tastytrade
// Uses the official @tastytrade/api SDK with OAuth

export default async function handler(req, res) {
  // Verify auth token
  const authHeader = req.headers.authorization;
  const expectedToken = Buffer.from((process.env.DASHBOARD_PASSWORD || "") + "_tradecockpit_auth").toString("base64");
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const clientSecret = process.env.TASTY_CLIENT_SECRET;
  const refreshToken = process.env.TASTY_REFRESH_TOKEN;

  if (!clientSecret || !refreshToken) {
    return res.status(500).json({
      error: "Tastytrade credentials not configured",
      hint: "Add TASTY_CLIENT_SECRET and TASTY_REFRESH_TOKEN to Vercel environment variables",
    });
  }

  try {
    // Dynamic import to avoid build issues
    const { default: TastytradeClient } = await import("@tastytrade/api");

    const client = new TastytradeClient({
      ...TastytradeClient.ProdConfig,
      clientSecret: clientSecret,
      refreshToken: refreshToken,
      oauthScopes: ["read", "trade"],
    });

    // Get all accounts
    const accounts =
      await client.accountsAndCustomersService.getCustomerAccounts();

    const result = {
      accounts: [],
    };

    for (const acctData of accounts) {
      const accountNumber = acctData.account["account-number"];
      const accountName =
        acctData.account.nickname || acctData.account["account-type-name"] || accountNumber;

      // Get balances
      let balance = null;
      try {
        const balanceData =
          await client.balancesAndPositionsService.getAccountBalances(
            accountNumber
          );
        balance = {
          cashBalance: parseFloat(
            balanceData["cash-balance"] || balanceData["net-liquidating-value"] || 0
          ),
          netLiq: parseFloat(balanceData["net-liquidating-value"] || 0),
          equityValue: parseFloat(balanceData["equity-value"] || 0),
        };
      } catch (e) {
        console.error(`Balance fetch error for ${accountNumber}:`, e.message);
      }

      // Get positions
      let positions = [];
      try {
        const positionData =
          await client.balancesAndPositionsService.getPositionsList(
            accountNumber
          );
        positions = positionData
          .filter(
            (p) =>
              p["instrument-type"] === "Equity" && parseFloat(p.quantity) > 0
          )
          .map((p) => ({
            ticker: p.symbol || p["underlying-symbol"],
            shares: parseFloat(p.quantity),
            averageOpenPrice: parseFloat(p["average-open-price"] || 0),
            currentPrice: parseFloat(p["close-price"] || 0),
            quantityDirection: p["quantity-direction"],
            costEffect: p["cost-effect"],
            createdAt: p["created-at"],
          }));
      } catch (e) {
        console.error(
          `Position fetch error for ${accountNumber}:`,
          e.message
        );
      }

      result.accounts.push({
        accountNumber,
        accountName,
        balance,
        positions,
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Tastytrade API Error:", error.message || error);
    res.status(500).json({
      error: "Failed to connect to Tastytrade",
      message: error.message || "Unknown error",
    });
  }
}
