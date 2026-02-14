// /api/auth.js — Verifies the dashboard password
// Password is stored in Vercel env var DASHBOARD_PASSWORD

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body;
  const correctPassword = process.env.DASHBOARD_PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({ error: "DASHBOARD_PASSWORD not set in Vercel environment variables" });
  }

  if (password === correctPassword) {
    // Return a simple token (hash of password + secret)
    const token = Buffer.from(correctPassword + "_tradecockpit_auth").toString("base64");
    return res.status(200).json({ success: true, token });
  }

  return res.status(401).json({ error: "Wrong password" });
}
