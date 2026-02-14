export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body;
  const correctPassword = process.env.DASHBOARD_PASSWORD;

  // Debug: tell us if the var exists at all
  if (!correctPassword) {
    return res.status(500).json({ 
      error: "DASHBOARD_PASSWORD not set in Vercel environment variables",
      envKeys: Object.keys(process.env).filter(k => k.includes("DASHBOARD") || k.includes("TASTY")).join(", ") || "none found"
    });
  }

  if (password === correctPassword) {
    const token = Buffer.from(correctPassword + "_tradecockpit_auth").toString("base64");
    return res.status(200).json({ success: true, token });
  }

  return res.status(401).json({ error: "Wrong password", hint: "Password exists but didn't match" });
}
