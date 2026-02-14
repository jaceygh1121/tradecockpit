// /api/tasty-callback.js — OAuth callback handler
// This receives the redirect from Tastytrade after authorization

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><body style="background:#0F1219;color:#F0F2F5;font-family:sans-serif;padding:40px;">
        <h2>Authorization Failed</h2>
        <p>Error: ${error}</p>
        <p><a href="/" style="color:#4F8EF7;">Back to Dashboard</a></p>
      </body></html>
    `);
  }

  if (code) {
    return res.status(200).send(`
      <html><body style="background:#0F1219;color:#F0F2F5;font-family:sans-serif;padding:40px;text-align:center;">
        <h2 style="color:#6BCB77;">Tastytrade Connected!</h2>
        <p>Authorization successful. Your dashboard will now sync with Tastytrade.</p>
        <p style="margin-top:20px;"><a href="/" style="color:#4F8EF7;font-size:18px;">Go to Dashboard →</a></p>
      </body></html>
    `);
  }

  res.status(400).send("Missing authorization code");
}
