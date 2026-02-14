import { useState, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";

const ACCOUNTS = [
  { id: "ira", name: "IRA", color: "#4F8EF7" },
  { id: "tasty", name: "Tasty", color: "#E5A24A" },
  { id: "inherited", name: "Inherited IRA", color: "#6BCB77" },
];

const RISK_OPTIONS = [0.5, 1.0, 1.5, 2.0];

// ============================================
// LIVE DATA FETCHER — calls our API route
// ============================================
async function fetchQuotes(tickers) {
  if (!tickers || tickers.length === 0) return {};
  try {
    const res = await fetch(`/api/quotes?tickers=${tickers.join(",")}`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch quotes:", err);
    return {};
  }
}

// ============================================
// LOCAL STORAGE HELPERS
// ============================================
function loadFromStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}

// Placeholder signals — will be replaced by email parser
const MOCK_SIGNALS = [
  { ticker: "CRDO", signal: "above", days: 3, sector: "Semiconductors", epsGrowth: "+142%", revGrowth: "+68%", nextEarnings: "Mar 12", description: "Designs high-speed connectivity solutions for data centers and AI infrastructure." },
  { ticker: "HOOD", signal: "above", days: 2, sector: "Fintech", epsGrowth: "+380%", revGrowth: "+36%", nextEarnings: "Apr 2", description: "Commission-free trading platform for stocks, crypto, and options." },
  { ticker: "VRT", signal: "above", days: 4, sector: "Industrials", epsGrowth: "+52%", revGrowth: "+28%", nextEarnings: "Feb 26", description: "Critical digital infrastructure and continuity solutions for data centers." },
  { ticker: "CEG", signal: "above", days: 2, sector: "Energy", epsGrowth: "+95%", revGrowth: "+12%", nextEarnings: "Feb 20", description: "Largest producer of carbon-free nuclear energy in the US." },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatCurrency(val) {
  if (val === undefined || val === null) return "$0.00";
  const neg = val < 0;
  const abs = Math.abs(val);
  if (abs >= 1000) {
    return (neg ? "-" : "") + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return (neg ? "-" : "") + "$" + abs.toFixed(2);
}

function formatPercent(val) {
  if (val === undefined || val === null) return "0.0%";
  return (val >= 0 ? "+" : "") + val.toFixed(1) + "%";
}

function getRvolColor(rvol) {
  if (rvol >= 2.0) return "#6BCB77";
  if (rvol >= 1.5) return "#4F8EF7";
  if (rvol >= 1.0) return "#8B9DAF";
  return "#5A6577";
}

function getExtensionColor(ext) {
  const abs = Math.abs(ext);
  if (abs < 3) return "#8B9DAF";
  if (abs < 6) return "#E5A24A";
  if (abs < 10) return "#E87B4A";
  return "#E84A5F";
}

function getStopColor(cushion, active) {
  if (!active) return "#8B9DAF";
  if (cushion > 15) return "#6BCB77";
  if (cushion > 7) return "#4F8EF7";
  if (cushion > 3) return "#E5A24A";
  return "#E84A5F";
}

// ============================================
// STYLES
// ============================================
const labelStyle = {
  display: "block", color: "#5A6577", fontSize: 11, marginBottom: 6,
  textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif"
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
  color: "#F0F2F5", fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
  outline: "none", boxSizing: "border-box"
};

// ============================================
// ADD POSITION MODAL
// ============================================
function AddPositionModal({ onClose, onAdd, accounts, riskPercent }) {
  const [ticker, setTicker] = useState("");
  const [account, setAccount] = useState(accounts[0].id);
  const [entry, setEntry] = useState("");
  const [shares, setShares] = useState("");
  const [manualShares, setManualShares] = useState(false);

  const acct = accounts.find((a) => a.id === account);
  const entryNum = parseFloat(entry);
  const stopPrice = entryNum ? entryNum * 0.9 : 0;
  const riskPerShare = entryNum ? entryNum - stopPrice : 0;
  const accountRisk = acct ? acct.balance * (riskPercent / 100) : 0;
  const calcShares = riskPerShare > 0 ? Math.floor(accountRisk / riskPerShare) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1A1F2E", borderRadius: 16, padding: 32, width: 440, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
        <h3 style={{ margin: "0 0 24px", color: "#F0F2F5", fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>New Position</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Ticker</label>
            <input style={inputStyle} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="NVDA" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Account</label>
            <div style={{ display: "flex", gap: 8 }}>
              {accounts.map((a) => (
                <button key={a.id} onClick={() => setAccount(a.id)} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid", borderColor: account === a.id ? a.color : "rgba(255,255,255,0.1)", background: account === a.id ? a.color + "18" : "transparent", color: account === a.id ? a.color : "#8B9DAF", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: account === a.id ? 600 : 400, transition: "all 0.2s ease" }}>
                  {a.name}
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{formatCurrency(a.balance)}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Entry Price</label>
            <input style={inputStyle} value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="0.00" type="number" step="0.01" />
          </div>
          {entryNum > 0 && (
            <div style={{ background: "rgba(79,142,247,0.06)", borderRadius: 10, padding: 16, border: "1px solid rgba(79,142,247,0.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Stop (-10%)</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(stopPrice)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Risk/Share</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(riskPerShare)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Account Risk ({riskPercent}%)</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(accountRisk)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}><span style={{ color: "#4F8EF7", fontSize: 13, fontWeight: 600 }}>Calculated Shares</span><span style={{ color: "#4F8EF7", fontSize: 15, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{calcShares}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Position Value</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(calcShares * entryNum)}</span></div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={manualShares} onChange={(e) => setManualShares(e.target.checked)} style={{ accentColor: "#4F8EF7" }} />
            <label style={{ color: "#8B9DAF", fontSize: 12 }}>Override share count</label>
            {manualShares && <input style={{ ...inputStyle, width: 80, marginLeft: "auto" }} value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Shares" type="number" />}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8B9DAF", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            <button onClick={() => { if (!ticker || !entryNum) return; onAdd({ ticker, account, entry: entryNum, shares: manualShares ? parseInt(shares) : calcShares, stop: stopPrice, triggered7: false, dateAdded: new Date().toLocaleDateString() }); onClose(); }} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4F8EF7, #3A6FD8)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(79,142,247,0.3)" }}>Add Position</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SELL MODAL
// ============================================
function SellModal({ position, onClose, onConfirm, quote }) {
  const gain = quote ? ((quote.price - position.entry) / position.entry) * 100 : 0;
  const pnl = quote ? (quote.price - position.entry) * position.shares : 0;
  const isMarketHours = (() => { const now = new Date(); const h = now.getHours(); const m = now.getMinutes(); const d = now.getDay(); if (d === 0 || d === 6) return false; const t = h * 60 + m; return t >= 570 && t <= 960; })();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1A1F2E", borderRadius: 16, padding: 32, width: 400, border: "1px solid rgba(232,74,95,0.2)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
        <h3 style={{ margin: "0 0 20px", color: "#E84A5F", fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>Sell {position.ticker}</h3>
        <div style={{ background: "rgba(232,74,95,0.06)", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid rgba(232,74,95,0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Shares</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{position.shares}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Entry → Current</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(position.entry)} → {formatCurrency(quote?.price)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>P&L</span><span style={{ color: pnl >= 0 ? "#6BCB77" : "#E84A5F", fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(pnl)} ({formatPercent(gain)})</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Order Type</span><span style={{ color: isMarketHours ? "#6BCB77" : "#E5A24A", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{isMarketHours ? "MARKET ORDER" : `LIMIT @ ${formatCurrency(quote?.price)}`}</span></div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8B9DAF", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={() => { onConfirm(position); onClose(); }} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #E84A5F, #C73A4E)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(232,74,95,0.3)" }}>Confirm Sell</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SIGNAL BUY MODAL
// ============================================
function SignalBuyModal({ signal, onClose, accounts, riskPercent, quote }) {
  const [account, setAccount] = useState(accounts[0].id);
  const acct = accounts.find((a) => a.id === account);
  const price = quote?.price || 0;
  const stopPrice = price * 0.9;
  const riskPerShare = price - stopPrice;
  const accountRisk = acct ? acct.balance * (riskPercent / 100) : 0;
  const calcShares = riskPerShare > 0 ? Math.floor(accountRisk / riskPerShare) : 0;
  const isMarketHours = (() => { const now = new Date(); const h = now.getHours(); const m = now.getMinutes(); const d = now.getDay(); if (d === 0 || d === 6) return false; const t = h * 60 + m; return t >= 570 && t <= 960; })();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1A1F2E", borderRadius: 16, padding: 32, width: 460, border: "1px solid rgba(107,203,119,0.2)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div><h3 style={{ margin: 0, color: "#6BCB77", fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>Buy {signal.ticker}</h3><p style={{ margin: "4px 0 0", color: "#8B9DAF", fontSize: 12 }}>{quote?.name}</p></div>
          <span style={{ background: "rgba(107,203,119,0.12)", color: "#6BCB77", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{signal.days}d {signal.signal} AVWAP</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "#8B9DAF", lineHeight: 1.5 }}>
          {signal.description}
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <span>EPS: <b style={{ color: "#6BCB77" }}>{signal.epsGrowth}</b></span>
            <span>Rev: <b style={{ color: "#6BCB77" }}>{signal.revGrowth}</b></span>
            <span>Earnings: <b style={{ color: "#E5A24A" }}>{signal.nextEarnings}</b></span>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Select Account</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {accounts.map((a) => (
              <button key={a.id} onClick={() => setAccount(a.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "1px solid", borderColor: account === a.id ? a.color : "rgba(255,255,255,0.1)", background: account === a.id ? a.color + "18" : "transparent", color: account === a.id ? a.color : "#8B9DAF", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: account === a.id ? 600 : 400, transition: "all 0.2s ease" }}>
                {a.name}<div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{formatCurrency(a.balance)}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: "rgba(107,203,119,0.06)", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid rgba(107,203,119,0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Current Price</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(price)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Stop (-10%)</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(stopPrice)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Account Risk ({riskPercent}%)</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(accountRisk)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}><span style={{ color: "#6BCB77", fontSize: 13, fontWeight: 600 }}>Shares</span><span style={{ color: "#6BCB77", fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{calcShares}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Position Value</span><span style={{ color: "#F0F2F5", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(calcShares * price)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ color: "#8B9DAF", fontSize: 12 }}>Order Type</span><span style={{ color: isMarketHours ? "#6BCB77" : "#E5A24A", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{isMarketHours ? "MARKET" : `LIMIT @ ${formatCurrency(price)}`}</span></div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8B9DAF", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={onClose} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6BCB77, #4AA85C)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(107,203,119,0.3)" }}>Buy {calcShares} Shares</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// POSITION ROW
// ============================================
function PositionRow({ position, quote, accountColor, onSell, onUpdateStop }) {
  const [editingStop, setEditingStop] = useState(false);
  const [stopInput, setStopInput] = useState("");
  const price = quote?.price || position.entry;
  const gain = ((price - position.entry) / position.entry) * 100;
  const pnl = (price - position.entry) * position.shares;
  const extension = quote?.sma10 ? ((price - quote.sma10) / quote.sma10) * 100 : 0;
  const dayChange = quote?.dayChange || 0;
  const rvol = quote?.rvol || 1.0;

  const triggered7 = position.triggered7 || gain >= 7;
  const hasManualStop = position.manualStop !== undefined && position.manualStop !== null;
  const autoStop = triggered7 ? position.entry : position.entry * 0.9;
  const currentStop = hasManualStop ? position.manualStop : autoStop;
  const stopReadingPct = ((price - currentStop) / price) * 100;
  const stopHit = price <= currentStop;

  const handleStopSubmit = () => { const val = parseFloat(stopInput); if (val > 0) onUpdateStop(position.id, val); setEditingStop(false); setStopInput(""); };
  const handleClearManualStop = () => { onUpdateStop(position.id, null); setEditingStop(false); setStopInput(""); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "4px 80px 1fr 80px 70px 100px 100px 90px 80px 70px", alignItems: "center", padding: "14px 16px", background: stopHit ? "rgba(232,74,95,0.06)" : "rgba(255,255,255,0.02)", borderRadius: 10, marginBottom: 6, border: stopHit ? "1px solid rgba(232,74,95,0.2)" : "1px solid rgba(255,255,255,0.04)", transition: "all 0.2s ease" }}>
      <div style={{ width: 4, height: 32, borderRadius: 2, background: accountColor, marginRight: 12 }} />
      <div><div style={{ color: "#F0F2F5", fontWeight: 600, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>{position.ticker}</div><div style={{ color: "#5A6577", fontSize: 11 }}>{position.shares} shares</div></div>
      <div style={{ color: "#8B9DAF", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(position.entry)} → {formatCurrency(price)}</div>
      <div style={{ textAlign: "center" }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: dayChange >= 0 ? "#6BCB77" : "#E84A5F" }}>{formatPercent(dayChange)}</span><div style={{ color: "#5A6577", fontSize: 10 }}>today</div></div>
      <div style={{ textAlign: "center" }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: getRvolColor(rvol) }}>{rvol.toFixed(1)}x</span><div style={{ color: "#5A6577", fontSize: 10 }}>rvol</div></div>
      <div style={{ textAlign: "right" }}><span style={{ color: pnl >= 0 ? "#6BCB77" : "#E84A5F", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>{formatCurrency(pnl)}</span><div style={{ color: gain >= 0 ? "#6BCB77" : "#E84A5F", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{formatPercent(gain)}</div></div>
      <div style={{ textAlign: "center" }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: getExtensionColor(extension) }}>{formatPercent(extension)}</span><div style={{ color: "#5A6577", fontSize: 10 }}>10d ext</div></div>
      {/* STOP — clickable to edit */}
      <div style={{ textAlign: "center", position: "relative" }}>
        {editingStop ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <input autoFocus value={stopInput} onChange={(e) => setStopInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleStopSubmit(); if (e.key === "Escape") { setEditingStop(false); setStopInput(""); } }} placeholder={currentStop.toFixed(2)} style={{ width: 72, padding: "4px 6px", borderRadius: 5, border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.08)", color: "#F0F2F5", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", outline: "none" }} />
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={handleStopSubmit} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "#4F8EF7", color: "#fff", cursor: "pointer", fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>SET</button>
              {hasManualStop && <button onClick={handleClearManualStop} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8B9DAF", cursor: "pointer", fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>AUTO</button>}
              <button onClick={() => { setEditingStop(false); setStopInput(""); }} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#5A6577", cursor: "pointer", fontSize: 9, fontFamily: "'DM Sans', sans-serif" }}>ESC</button>
            </div>
          </div>
        ) : (
          <div onClick={() => { setEditingStop(true); setStopInput(currentStop.toFixed(2)); }} style={{ cursor: "pointer" }} title="Click to set manual stop">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: getStopColor(stopReadingPct, triggered7 || hasManualStop) }}>{formatPercent(stopReadingPct)}</span>
              <span style={{ background: hasManualStop ? "rgba(229,162,74,0.15)" : (triggered7 ? "rgba(79,142,247,0.15)" : "transparent"), color: hasManualStop ? "#E5A24A" : "#4F8EF7", padding: "1px 5px", borderRadius: 4, fontSize: 9, fontWeight: 700, display: (hasManualStop || triggered7) ? "inline" : "none" }}>{hasManualStop ? "M" : "BE"}</span>
            </div>
            <div style={{ color: "#5A6577", fontSize: 10 }}>stop @ {formatCurrency(currentStop)}</div>
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8B9DAF" }}>{formatCurrency(position.shares * price)}</div>
      <div style={{ textAlign: "right" }}>
        <button onClick={() => onSell(position)} style={{ padding: "6px 14px", borderRadius: 6, border: stopHit ? "1px solid #E84A5F" : "1px solid rgba(232,74,95,0.3)", background: stopHit ? "rgba(232,74,95,0.15)" : "transparent", color: "#E84A5F", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease", animation: stopHit ? "pulse 2s infinite" : "none" }}>SELL</button>
      </div>
    </div>
  );
}

// ============================================
// SIGNAL ROW
// ============================================
function SignalRow({ signal, quote, onBuy }) {
  const price = quote?.price || 0;
  const extension = quote?.sma10 ? ((price - quote.sma10) / quote.sma10) * 100 : 0;
  const dayChange = quote?.dayChange || 0;
  const rvol = quote?.rvol || 1.0;

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 8, transition: "all 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div><span style={{ color: "#F0F2F5", fontSize: 18, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{signal.ticker}</span><span style={{ color: "#5A6577", fontSize: 12, marginLeft: 8 }}>{signal.sector}</span></div>
          <span style={{ background: signal.signal === "above" ? "rgba(107,203,119,0.12)" : signal.signal === "below" ? "rgba(232,74,95,0.12)" : signal.signal === "breakout" ? "rgba(107,203,119,0.12)" : signal.signal === "pullback" ? "rgba(229,162,74,0.12)" : signal.signal === "earnings" ? "rgba(232,123,74,0.12)" : "rgba(79,142,247,0.12)", color: signal.signal === "above" ? "#6BCB77" : signal.signal === "below" ? "#E84A5F" : signal.signal === "breakout" ? "#6BCB77" : signal.signal === "pullback" ? "#E5A24A" : signal.signal === "earnings" ? "#E87B4A" : "#4F8EF7", padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{signal.days > 0 ? `${signal.days}d ${signal.signal} AVWAP` : signal.signal === "watchlist" ? "WATCHING" : signal.signal.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: dayChange >= 0 ? "#6BCB77" : "#E84A5F" }}>{formatPercent(dayChange)}</span><div style={{ color: "#5A6577", fontSize: 10 }}>today</div></div>
          <div style={{ textAlign: "center" }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: getRvolColor(rvol) }}>{rvol.toFixed(1)}x</span><div style={{ color: "#5A6577", fontSize: 10 }}>rvol</div></div>
          <div style={{ textAlign: "right" }}><div style={{ color: "#F0F2F5", fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(price)}</div><div style={{ color: getExtensionColor(extension), fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{formatPercent(extension)} from 10d</div></div>
        </div>
      </div>
      <p style={{ color: "#8B9DAF", fontSize: 12, lineHeight: 1.5, margin: "0 0 12px" }}>{signal.description}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div><span style={{ color: "#5A6577", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>EPS Growth</span><div style={{ color: "#6BCB77", fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{signal.epsGrowth}</div></div>
          <div><span style={{ color: "#5A6577", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue</span><div style={{ color: "#6BCB77", fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{signal.revGrowth}</div></div>
          <div><span style={{ color: "#5A6577", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Earnings</span><div style={{ color: "#E5A24A", fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{signal.nextEarnings}</div></div>
        </div>
        <button onClick={() => onBuy(signal)} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6BCB77, #4AA85C)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(107,203,119,0.25)", transition: "all 0.2s ease" }}>BUY →</button>
      </div>
    </div>
  );
}

// ============================================
// ADD SIGNAL MODAL
// ============================================
function AddSignalModal({ onClose, onAdd }) {
  const [ticker, setTicker] = useState("");
  const [sector, setSector] = useState("");
  const [description, setDescription] = useState("");
  const [signalType, setSignalType] = useState("watchlist");
  const [notes, setNotes] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1A1F2E", borderRadius: 16, padding: 32, width: 440, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
        <h3 style={{ margin: "0 0 24px", color: "#4F8EF7", fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>Add to Watchlist</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Ticker *</label>
            <input style={inputStyle} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Signal Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "watchlist", label: "Watchlist", color: "#4F8EF7" }, { id: "breakout", label: "Breakout", color: "#6BCB77" }, { id: "pullback", label: "Pullback", color: "#E5A24A" }, { id: "earnings", label: "Earnings", color: "#E87B4A" }].map((t) => (
                <button key={t.id} onClick={() => setSignalType(t.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "1px solid", borderColor: signalType === t.id ? t.color : "rgba(255,255,255,0.1)", background: signalType === t.id ? t.color + "18" : "transparent", color: signalType === t.id ? t.color : "#8B9DAF", cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: signalType === t.id ? 600 : 400, transition: "all 0.2s ease" }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Sector</label>
            <input style={inputStyle} value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. Semiconductors, Energy" />
          </div>
          <div>
            <label style={labelStyle}>Notes / Why you're watching</label>
            <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Tight base forming, earnings Feb 20" />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8B9DAF", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            <button onClick={() => { if (!ticker) return; onAdd({ ticker, signal: signalType, days: 0, sector: sector || "—", epsGrowth: "—", revGrowth: "—", nextEarnings: "—", description: notes || "Manually added to watchlist" }); onClose(); }} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4F8EF7, #3A6FD8)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(79,142,247,0.3)" }}>Add to Watchlist</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function TradingDashboard() {
  const [tab, setTab] = useState("holdings");
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sellTarget, setSellTarget] = useState(null);
  const [buySignal, setBuySignal] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Persistent state — loads from localStorage on mount
  const [accountBalances, setAccountBalances] = useState({ ira: 0, tasty: 0, inherited: 0 });
  const [positions, setPositions] = useState([]);
  const [manualSignals, setManualSignals] = useState([]);
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setAccountBalances(loadFromStorage("tc_balances", { ira: 42000, tasty: 28000, inherited: 24000 }));
    setPositions(loadFromStorage("tc_positions", []));
    setManualSignals(loadFromStorage("tc_manual_signals", []));
    setRiskPercent(loadFromStorage("tc_risk", 1.0));
    setMounted(true);
  }, []);

  // Save to localStorage when data changes
  useEffect(() => { if (mounted) saveToStorage("tc_positions", positions); }, [positions, mounted]);
  useEffect(() => { if (mounted) saveToStorage("tc_balances", accountBalances); }, [accountBalances, mounted]);
  useEffect(() => { if (mounted) saveToStorage("tc_risk", riskPercent); }, [riskPercent, mounted]);
  useEffect(() => { if (mounted) saveToStorage("tc_manual_signals", manualSignals); }, [manualSignals, mounted]);

  const allSignals = [...MOCK_SIGNALS, ...manualSignals];

  const accounts = ACCOUNTS.map((a) => ({ ...a, balance: accountBalances[a.id] }));

  // Fetch live quotes
  const refreshQuotes = useCallback(async () => {
    const allTickers = [...new Set([...positions.map((p) => p.ticker), ...MOCK_SIGNALS.map((s) => s.ticker), ...manualSignals.map((s) => s.ticker)])];
    if (allTickers.length === 0) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchQuotes(allTickers);
    if (Object.keys(data).length > 0) setQuotes(data);
    setLastUpdate(new Date().toLocaleTimeString());
    setLoading(false);
  }, [positions, manualSignals]);

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    if (!mounted) return;
    refreshQuotes();
    const interval = setInterval(refreshQuotes, 60000);
    return () => clearInterval(interval);
  }, [mounted, refreshQuotes]);

  // Check for 7% triggers
  useEffect(() => {
    if (!mounted) return;
    setPositions((prev) => prev.map((p) => {
      const q = quotes[p.ticker];
      if (!q || p.triggered7) return p;
      const gain = ((q.price - p.entry) / p.entry) * 100;
      if (gain >= 7) return { ...p, triggered7: true };
      return p;
    }));
  }, [quotes, mounted]);

  // Risk calculations
  const riskByAccount = useMemo(() => {
    const result = {};
    ACCOUNTS.forEach((a) => {
      const acctPositions = positions.filter((p) => p.account === a.id);
      const balance = accountBalances[a.id];
      let totalRisk = 0;
      acctPositions.forEach((p) => {
        const q = quotes[p.ticker];
        const price = q?.price || p.entry;
        const gain = ((price - p.entry) / p.entry) * 100;
        const triggered7 = p.triggered7 || gain >= 7;
        const hasManualStop = p.manualStop !== undefined && p.manualStop !== null;
        const autoStop = triggered7 ? p.entry : p.entry * 0.9;
        const currentStop = hasManualStop ? p.manualStop : autoStop;
        totalRisk += Math.max(0, (price - currentStop) * p.shares);
      });
      result[a.id] = {
        totalRisk,
        riskPercent: balance > 0 ? (totalRisk / balance) * 100 : 0,
        positionCount: acctPositions.length,
        totalValue: acctPositions.reduce((s, p) => s + (quotes[p.ticker]?.price || p.entry) * p.shares, 0),
        totalPnL: acctPositions.reduce((s, p) => s + ((quotes[p.ticker]?.price || p.entry) - p.entry) * p.shares, 0),
      };
    });
    return result;
  }, [positions, quotes, accountBalances]);

  const totalPortfolioRisk = Object.values(riskByAccount).reduce((s, r) => s + r.totalRisk, 0);
  const totalBalance = Object.values(accountBalances).reduce((s, b) => s + b, 0);
  const totalPnL = Object.values(riskByAccount).reduce((s, r) => s + r.totalPnL, 0);

  const handleAddPosition = (pos) => setPositions((prev) => [...prev, { ...pos, id: Date.now() }]);
  const handleUpdateStop = (id, stop) => setPositions((prev) => prev.map((p) => p.id === id ? { ...p, manualStop: stop } : p));
  const handleSell = (pos) => { setPositions((prev) => prev.filter((p) => p.id !== pos.id)); setSellTarget(null); };

  // Editable account balances
  const [editingBalance, setEditingBalance] = useState(null);
  const [balanceInput, setBalanceInput] = useState("");

  if (!mounted) return <div style={{ minHeight: "100vh", background: "#0F1219", display: "flex", alignItems: "center", justifyContent: "center", color: "#5A6577" }}>Loading...</div>;

  return (
    <>
      <Head>
        <title>TradeCockpit</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#0F1219", color: "#F0F2F5", fontFamily: "'DM Sans', sans-serif" }}>
        {/* HEADER */}
        <div style={{ padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,18,25,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #4F8EF7, #6BCB77)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>T</div>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>TradeCockpit</span>
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
              {["holdings", "signals"].map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: tab === t ? "rgba(79,142,247,0.15)" : "transparent", color: tab === t ? "#4F8EF7" : "#5A6577", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 600 : 400, textTransform: "capitalize", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease" }}>
                  {t === "signals" && <span style={{ background: "#E84A5F", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginRight: 6, fontWeight: 700 }}>{allSignals.length}</span>}
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {lastUpdate && <span style={{ color: "#5A6577", fontSize: 11 }}>Updated {lastUpdate}</span>}
            <button onClick={refreshQuotes} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#8B9DAF", cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>{loading ? "..." : "↻ Refresh"}</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#5A6577", fontSize: 11, textTransform: "uppercase" }}>Risk</span>
              <div style={{ display: "flex", gap: 4 }}>
                {RISK_OPTIONS.map((r) => (
                  <button key={r} onClick={() => setRiskPercent(r)} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid", borderColor: riskPercent === r ? "#4F8EF7" : "rgba(255,255,255,0.08)", background: riskPercent === r ? "rgba(79,142,247,0.12)" : "transparent", color: riskPercent === r ? "#4F8EF7" : "#5A6577", cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: riskPercent === r ? 600 : 400 }}>{r}%</button>
                ))}
              </div>
            </div>
            {tab === "holdings" && <button onClick={() => setShowAddModal(true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #4F8EF7, #3A6FD8)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(79,142,247,0.25)" }}>+ Add Position</button>}
          </div>
        </div>

        {/* ACCOUNT RISK SUMMARY */}
        <div style={{ padding: "20px 32px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {accounts.map((acct) => {
              const risk = riskByAccount[acct.id] || {};
              const isEditing = editingBalance === acct.id;
              return (
                <div key={acct.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${acct.color}`, animation: "fadeIn 0.4s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: acct.color, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{acct.name}</span>
                    <span style={{ color: "#5A6577", fontSize: 11 }}>{risk.positionCount || 0} positions</span>
                  </div>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <input autoFocus value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat(balanceInput); if (v >= 0) setAccountBalances((prev) => ({ ...prev, [acct.id]: v })); setEditingBalance(null); } if (e.key === "Escape") setEditingBalance(null); }} style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.08)", color: "#F0F2F5", fontSize: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, outline: "none" }} />
                    </div>
                  ) : (
                    <div onClick={() => { setEditingBalance(acct.id); setBalanceInput(acct.balance.toString()); }} style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4, cursor: "pointer" }} title="Click to edit balance">
                      {formatCurrency(acct.balance)}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><span style={{ color: "#5A6577", fontSize: 10 }}>P&L </span><span style={{ color: (risk.totalPnL || 0) >= 0 ? "#6BCB77" : "#E84A5F", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(risk.totalPnL || 0)}</span></div>
                    <div style={{ background: (risk.riskPercent || 0) > 5 ? "rgba(232,74,95,0.12)" : "rgba(79,142,247,0.12)", padding: "3px 8px", borderRadius: 5 }}><span style={{ color: "#5A6577", fontSize: 10 }}>RISK </span><span style={{ color: (risk.riskPercent || 0) > 5 ? "#E84A5F" : "#4F8EF7", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{(risk.riskPercent || 0).toFixed(1)}%</span></div>
                  </div>
                </div>
              );
            })}
            {/* COMBINED */}
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.08)", animation: "fadeIn 0.5s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ color: "#F0F2F5", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Combined</span><span style={{ color: "#5A6577", fontSize: 11 }}>{positions.length} total</span></div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{formatCurrency(totalBalance)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><span style={{ color: "#5A6577", fontSize: 10 }}>P&L </span><span style={{ color: totalPnL >= 0 ? "#6BCB77" : "#E84A5F", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(totalPnL)}</span></div>
                <div style={{ background: totalBalance > 0 && totalPortfolioRisk / totalBalance > 0.05 ? "rgba(232,74,95,0.12)" : "rgba(79,142,247,0.12)", padding: "3px 8px", borderRadius: 5 }}><span style={{ color: "#5A6577", fontSize: 10 }}>RISK </span><span style={{ color: totalBalance > 0 && totalPortfolioRisk / totalBalance > 0.05 ? "#E84A5F" : "#4F8EF7", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{totalBalance > 0 ? ((totalPortfolioRisk / totalBalance) * 100).toFixed(1) : "0.0"}%</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ padding: "20px 32px 40px" }}>
          {tab === "holdings" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "4px 80px 1fr 80px 70px 100px 100px 90px 80px 70px", padding: "8px 16px 12px", color: "#5A6577", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <div /><div>Ticker</div><div>Entry → Current</div><div style={{ textAlign: "center" }}>Today</div><div style={{ textAlign: "center" }}>RVol</div><div style={{ textAlign: "right" }}>P&L</div><div style={{ textAlign: "center" }}>Extension</div><div style={{ textAlign: "center" }}>Stop</div><div style={{ textAlign: "right" }}>Value</div><div />
              </div>
              {accounts.map((acct) => {
                const acctPositions = positions.filter((p) => p.account === acct.id);
                if (acctPositions.length === 0) return null;
                return (
                  <div key={acct.id} style={{ marginBottom: 20 }}>
                    <div style={{ color: acct.color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 16 }}>{acct.name}</div>
                    {acctPositions.map((p) => <PositionRow key={p.id} position={p} quote={quotes[p.ticker]} accountColor={acct.color} onSell={setSellTarget} onUpdateStop={handleUpdateStop} />)}
                  </div>
                );
              })}
              {positions.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#5A6577", fontSize: 14 }}>No positions yet. Click "+ Add Position" to get started.</div>}
            </div>
          )}

          {tab === "signals" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div><h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Signals & Watchlist</h2><p style={{ color: "#5A6577", fontSize: 12, margin: "4px 0 0" }}>AVWAP algo signals + your manual additions</p></div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: 4, background: "#6BCB77" }} /><span style={{ color: "#8B9DAF", fontSize: 12 }}>Email sync active</span></div>
                  <button onClick={() => setShowAddSignal(true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #4F8EF7, #3A6FD8)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(79,142,247,0.25)" }}>+ Add Signal</button>
                </div>
              </div>

              {/* ALGO SIGNALS */}
              {MOCK_SIGNALS.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: "#6BCB77", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>AVWAP Algo Signals</div>
                  {MOCK_SIGNALS.map((signal) => <SignalRow key={"algo-" + signal.ticker} signal={signal} quote={quotes[signal.ticker]} onBuy={setBuySignal} />)}
                </div>
              )}

              {/* MANUAL SIGNALS */}
              {manualSignals.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: "#4F8EF7", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Manual Watchlist</div>
                  {manualSignals.map((signal) => (
                    <div key={"manual-" + signal.ticker} style={{ position: "relative" }}>
                      <SignalRow signal={signal} quote={quotes[signal.ticker]} onBuy={setBuySignal} />
                      <button onClick={() => setManualSignals((prev) => prev.filter((s) => s.id !== signal.id))} style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(232,74,95,0.08)", color: "#E84A5F", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }} title="Remove from watchlist">×</button>
                    </div>
                  ))}
                </div>
              )}

              {allSignals.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#5A6577", fontSize: 14 }}>No signals yet. Algo signals will appear here, or click "+ Add Signal" to add your own.</div>}
            </div>
          )}
        </div>

        {/* MODALS */}
        {showAddModal && <AddPositionModal onClose={() => setShowAddModal(false)} onAdd={handleAddPosition} accounts={accounts} riskPercent={riskPercent} />}
        {sellTarget && <SellModal position={sellTarget} onClose={() => setSellTarget(null)} onConfirm={handleSell} quote={quotes[sellTarget.ticker]} />}
        {buySignal && <SignalBuyModal signal={buySignal} onClose={() => setBuySignal(null)} accounts={accounts} riskPercent={riskPercent} quote={quotes[buySignal.ticker]} />}
        {showAddSignal && <AddSignalModal onClose={() => setShowAddSignal(false)} onAdd={(signal) => setManualSignals((prev) => [...prev, { ...signal, id: Date.now() }])} />}
      </div>
    </>
  );
}
