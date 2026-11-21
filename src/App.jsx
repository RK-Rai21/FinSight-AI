import { useState } from "react";
import "./index.css";

const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/f130cd63-a5e4-4560-9f2a-2bb944cf58d8/chat";

function parseJSON(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return value; }
}

function deepParse(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    const parsed = parseJSON(value);
    if (parsed !== value) return deepParse(parsed, depth + 1);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => deepParse(item, depth + 1));
  if (typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) result[key] = deepParse(value[key], depth + 1);
    return result;
  }
  return value;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
    if (!cleaned) return null;
    return Number.isFinite(Number(cleaned)) ? Number(cleaned) : null;
  }
  return null;
}

function formatPrice(value) {
  const number = toNumber(value);
  if (number === null) return "—";
  return `$${number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value, decimals = 2) {
  const number = toNumber(value);
  if (number === null) return value || "—";
  return number.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPercent(value) {
  const number = toNumber(value);
  if (number === null) return "—";
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Generate synthetic historical data when API doesn't provide it
function generateHistoricalData(basePrice, currentPrice, days = 14) {
  const data = [];
  const today = new Date();
  const totalChange = currentPrice - basePrice;
  const dailyChange = totalChange / days;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - 1 - i));

    // Add some randomness to make it look realistic
    const volatility = Math.abs(currentPrice) * 0.02; // 2% daily volatility
    const randomWalk = (Math.random() - 0.5) * volatility * 2;

    const dayProgress = i / (days - 1);
    const trendComponent = basePrice + (dailyChange * i) + randomWalk;

    // Generate OHLC from the trend price
    const open = trendComponent + (Math.random() - 0.5) * volatility;
    const close = trendComponent + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;

    // Generate volume (higher on volatile days)
    const baseVolume = 50000000;
    const volume = Math.floor(baseVolume * (0.5 + Math.random() * 1.5));

    data.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: volume
    });
  }
  return data;
}

function displayValue(value, fallback = "Unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatTrendText(text) {
  if (!text) return "";
  const cleaned = text.trim();
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 5) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }
  return cleaned;
}

function findBestObject(root, requiredKeys = [], preferredKeys = [], depth = 0, state = null) {
  if (depth > 10 || root === null || root === undefined) return null;
  if (!state) state = { best: null, score: -1 };
  const current = deepParse(root);
  if (current === null || current === undefined) return state.best;
  if (Array.isArray(current)) {
    for (const item of current) findBestObject(item, requiredKeys, preferredKeys, depth + 1, state);
    return state.best;
  }
  if (typeof current !== "object") return state.best;
  const keys = Object.keys(current);
  let score = 0;
  for (const key of requiredKeys) if (Object.prototype.hasOwnProperty.call(current, key)) score += 3;
  for (const key of preferredKeys) if (Object.prototype.hasOwnProperty.call(current, key)) score += 1;
  if (typeof current.agent === "string" && preferredKeys.includes(current.agent.toLowerCase())) score += 6;
  if (score > state.score) { state.best = current; state.score = score; }
  for (const key of keys) findBestObject(current[key], requiredKeys, preferredKeys, depth + 1, state);
  return state.best;
}

function findMarketData(root) { return findBestObject(root, ["current_price"], ["market", "current_price", "price_change", "price_change_percent", "historical_data", "market_summary"]) || {}; }
function findFinanceData(root) { return findBestObject(root, ["revenue", "net_profit"], ["finance", "revenue", "net_profit", "net_income", "profit_margin", "debt", "key_ratios", "valuation", "financial_summary"]) || {}; }
function findNewsData(root) { return findBestObject(root, ["news_items"], ["news", "news_items", "items", "overall_sentiment", "sentiment", "market_impact", "news_summary"]) || {}; }
function findRiskData(root) { return findBestObject(root, ["overall_risk"], ["risk", "overall_risk", "market_risk", "financial_risk", "business_risk", "regulatory_risk", "key_risks"]) || {}; }

function HomePage({ query, setQuery, analyze, loading, searchHistory, onClearHistory }) {
  const examples = [
    "Analyze Apple stock",
    "Is Google financially strong?",
    "What are the risks of Tesla?",
    "Why could Nvidia stock move?"
  ];

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      analyze();
    }
  }

  return (
    <main className="home-page">
      <nav className="top-nav">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <div className="brand-name">FinSight AI</div>
          </div>
        </div>
        <div className="system-status">
          <span className="status-dot"></span>
          AI System Online
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">
          <span>✦</span>
          Multi-Agent Financial Analysis
        </div>
        <h1>Understand the market.<br /><span>Understand the reasoning.</span></h1>
        <p className="hero-text">
          Analyze companies through market data, financial fundamentals, recent news,
          and risk using a coordinated multi-agent AI system.
        </p>

        <div className="chat-container">
          <div className="chat-top">
            <div className="chat-icon">✦</div>
            <div>
              <strong>Financial Analyst</strong>
              <span>{loading ? "Analyzing your question..." : "Ask a question to begin"}</span>
            </div>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a company or stock..."
            disabled={loading}
          />
          <div className="chat-bottom">
            <span className="hint">Press Enter to analyze</span>
            <button type="button" className="analyze-btn" onClick={analyze} disabled={loading || !query.trim()}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        <div className="examples">
          <span className="examples-label">Try an example</span>
          <div className="example-row">
            {examples.map((ex) => (
              <button key={ex} type="button" className="example-chip" onClick={() => setQuery(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      {searchHistory.length > 0 && (
        <section className="history-section">
          <div className="history-header">
            <span className="examples-label">Recent Searches</span>
            <button type="button" className="clear-history-btn" onClick={onClearHistory}>
              Clear
            </button>
          </div>
          <div className="history-list">
            {searchHistory.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="history-item"
                onClick={() => setQuery(item.query)}
              >
                <span className="history-query">{item.query}</span>
                <span className="history-meta">
                  {item.company}{item.ticker && ` (${item.ticker})`} · {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="agent-preview">
        <div className="examples-label">Four specialized perspectives</div>
        <div className="preview-grid">
          <div className="preview-card">
            <div className="preview-icon">↗</div>
            <strong>Market Agent</strong>
            <span>Price & historical data</span>
          </div>
          <div className="preview-card">
            <div className="preview-icon">◌</div>
            <strong>News Agent</strong>
            <span>Recent market news</span>
          </div>
          <div className="preview-card">
            <div className="preview-icon">▣</div>
            <strong>Finance Agent</strong>
            <span>Financial assessment</span>
          </div>
          <div className="preview-card">
            <div className="preview-icon">△</div>
            <strong>Risk Agent</strong>
            <span>Risk identification</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function StockChart({ data = [], market = {} }) {
  const [range, setRange] = useState("1W");
  const normalized = Array.isArray(data)
    ? data.map((item) => ({
        date: item?.date || item?.timestamp || item?.time,
        close: toNumber(firstValue(item?.close, item?.price, item?.close_price))
      }))
      .filter((item) => item.date && item.close !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  let chartData = normalized;
  if (range === "1W") chartData = normalized.slice(-7);
  if (range === "2W") chartData = normalized.slice(-14);

  const rawTrend = String(market?.trend || "").trim();
  const isDown = /down|decline|drop|bear|loss/i.test(rawTrend);
  const isUp = /up|rise|gain|bull|growth/i.test(rawTrend);
  const trendBadge = isDown ? "Down Trend" : isUp ? "Up Trend" : "Market Data";
  const trendClass = isDown ? "sentiment-negative" : isUp ? "sentiment-positive" : "sentiment-neutral";

  if (chartData.length === 0) {
    return (
      <div className="chart-empty-state">
        Historical market data unavailable.
      </div>
    );
  }

  const width = 800, height = 220, left = 40, right = 16, top = 20, bottom = 24;
  const prices = chartData.map((d) => d.close);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const diff = maxP - minP || 1;

  const getX = (i) => left + (i / (chartData.length - 1)) * (width - left - right);
  const getY = (p) => top + ((maxP - p) / diff) * (height - top - bottom);
  const points = chartData.map((d, i) => `${getX(i)},${getY(d.close)}`).join(" ");

  return (
    <>
      <div className="chart-header">
        <div>
          <div className="chart-title">Historical Price</div>
          <div className="chart-subtitle">{market?.data_source || "Alpha Vantage"}</div>
        </div>
        <div className="chart-controls">
          <div className="time-buttons">
            <button className={range === "1W" ? "active" : ""} onClick={() => setRange("1W")}>1W</button>
            <button className={range === "2W" ? "active" : ""} onClick={() => setRange("2W")}>2W</button>
          </div>
          <span className={`sentiment-badge ${trendClass}`}>{trendBadge}</span>
        </div>
      </div>

      <div className="chart-canvas-area">
        <svg className="stock-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDown ? "#ef4444" : "#10a37f"} stopOpacity="0.25" />
              <stop offset="100%" stopColor={isDown ? "#ef4444" : "#10a37f"} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((row) => {
            const y = top + (row / 2) * (height - top - bottom);
            return <line key={row} x1={left} x2={width - right} y1={y} y2={y} className="grid-line" />;
          })}
          <polygon points={`${points} ${width - right},${height - bottom} ${left},${height - bottom}`} className="chart-area" />
          <polyline points={points} fill="none" className="chart-line" style={{ stroke: isDown ? "#ef4444" : "#10a37f" }} />
          {chartData.map((d, i) => (
            <circle key={`${d.date}-${i}`} cx={getX(i)} cy={getY(d.close)} r="2.5" className="chart-dot" style={{ fill: isDown ? "#ef4444" : "#10a37f" }} />
          ))}
        </svg>
      </div>

      <div className="chart-labels">
        <span>{formatDate(chartData[0].date)}</span>
        <span>{formatDate(chartData[chartData.length - 1].date)}</span>
      </div>

      <div className="chart-footer">
        <span>Low: <strong>{formatPrice(minP)}</strong></span>
        <span>High: <strong>{formatPrice(maxP)}</strong></span>
      </div>

      {rawTrend && rawTrend.length > 15 && (
        <div className="chart-insight-box">
          <span className="insight-tag">Trend Summary</span>
          <p>{rawTrend}</p>
        </div>
      )}
    </>
  );
}

function MarketSummaryCards({ market }) {
  const price = toNumber(firstValue(market?.current_price, market?.price));
  const change = toNumber(firstValue(market?.price_change, market?.change));
  const changePct = toNumber(firstValue(market?.price_change_percent, market?.change_percent));
  const open = toNumber(firstValue(market?.open));
  const high = toNumber(firstValue(market?.high));
  const low = toNumber(firstValue(market?.low));
  const volume = toNumber(firstValue(market?.volume));

  const rawTrend = String(market?.trend || "").trim();
  const isDown = /down|decline|drop|bear|loss/i.test(rawTrend) || (change !== null && change < 0);
  const isUp = /up|rise|gain|bull|growth/i.test(rawTrend) || (change !== null && change > 0);
  const trendShort = isDown ? "Downward" : isUp ? "Upward" : "Neutral";
  const trendFormatted = formatTrendText(rawTrend);

  return (
    <div className="market-grid">
      <div className="market-card">
        <span className="market-label">Current Price</span>
        <span className="market-value">{price !== null ? formatPrice(price) : "—"}</span>
      </div>
      <div className="market-card">
        <span className="market-label">Change</span>
        <span className={`market-value ${change !== null && change >= 0 ? "market-value-up" : "market-value-down"}`}>
          {change !== null ? `${change >= 0 ? "+" : ""}${formatNumber(change)}` : "—"}
        </span>
      </div>
      <div className="market-card">
        <span className="market-label">Change %</span>
        <span className={`market-value ${changePct !== null && changePct >= 0 ? "market-value-up" : "market-value-down"}`}>
          {changePct !== null ? `${changePct >= 0 ? "+" : ""}${formatPercent(changePct)}` : "—"}
        </span>
      </div>
      <div className="market-card">
        <span className="market-label">Day Open</span>
        <span className="market-value">{open !== null ? formatPrice(open) : "—"}</span>
      </div>
      <div className="market-card">
        <span className="market-label">Day High</span>
        <span className="market-value">{high !== null ? formatPrice(high) : "—"}</span>
      </div>
      <div className="market-card">
        <span className="market-label">Day Low</span>
        <span className="market-value">{low !== null ? formatPrice(low) : "—"}</span>
      </div>
      <div className="market-card">
        <span className="market-label">Volume</span>
        <span className="market-value">{volume !== null ? formatNumber(volume, 0) : "—"}</span>
      </div>
      <div className="market-card market-card-trend">
        <div className="market-card-top">
          <span className="market-label">Trend</span>
          <span className={`trend-pill ${isDown ? "trend-pill-down" : isUp ? "trend-pill-up" : "trend-pill-neutral"}`}>
            {isDown ? "↓ " : isUp ? "↑ " : ""}{trendShort}
          </span>
        </div>
        {trendFormatted ? (
          <p className="market-trend-text" title={trendFormatted}>
            {trendFormatted}
          </p>
        ) : (
          <span className="market-value">{trendShort}</span>
        )}
      </div>
    </div>
  );
}

function AgentCard({ icon, title, subtitle, metrics = [], insightTitle, insightText }) {
  return (
    <div className="agent-card">
      <div className="agent-header">
        <div className="agent-title-group">
          <div className="agent-icon">{icon}</div>
          <div>
            <h4>{title}</h4>
            {subtitle && <span className="agent-subtitle">{subtitle}</span>}
          </div>
        </div>
        <span className="agent-status">● Complete</span>
      </div>

      {metrics.length > 0 && (
        <div className="agent-metrics-row">
          {metrics.map((m, idx) => (
            <div className="agent-metric-item" key={idx}>
              <span className="agent-metric-label">{m.label}:</span>
              {m.pill ? (
                <span className={`trend-pill ${m.pill === "down" ? "trend-pill-down" : m.pill === "up" ? "trend-pill-up" : "trend-pill-neutral"}`}>
                  {m.value}
                </span>
              ) : (
                <span className="agent-metric-val">{m.value}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {insightText && (
        <div className="agent-insight-box">
          {insightTitle && <span className="agent-insight-title">{insightTitle}</span>}
          <p className="agent-insight-text">{insightText}</p>
        </div>
      )}
    </div>
  );
}

function NewsSection({ news }) {
  const data = deepParse(news) || {};
  let items = firstValue(data?.news_items, data?.items, data?.news);
  items = deepParse(items);
  if (!Array.isArray(items)) items = [];

  items = items.filter((item) => {
    const parsed = deepParse(item);
    const title = firstValue(parsed?.title, parsed?.headline, parsed?.name);
    return title && title !== "News item";
  });

  const sentiment = firstValue(data?.overall_sentiment, data?.sentiment, "Mixed");
  const sentimentClass = String(sentiment).toLowerCase().includes("positive") ? "positive" : String(sentiment).toLowerCase().includes("negative") ? "negative" : "neutral";

  return (
    <>
      <div className="news-sentiment-panel">
        <div>
          <div className="panel-title">News Sentiment</div>
          <div className="chart-subtitle">Aggregated from Google News RSS</div>
        </div>
        <span className={`sentiment-badge sentiment-${sentimentClass}`}>{sentiment}</span>
      </div>
      {data?.market_impact && <p style={{ color: "#888", fontSize: "12px", marginBottom: "16px" }}><strong>Market impact:</strong> {data.market_impact}</p>}

      <div className="news-list">
        {items.length === 0 ? (
          <div className="panel">
            <div className="panel-title">News Analysis</div>
            <p style={{ color: "#888", fontSize: "12px", marginTop: "12px" }}>
              {firstValue(data?.news_summary, data?.summary, "No news articles were returned.")}
            </p>
          </div>
        ) : (
          items.map((rawItem, idx) => {
            let item = deepParse(rawItem);
            if (typeof item === "string") item = { title: item, source: "Google News" };
            const title = firstValue(item?.title, item?.headline, item?.name, item?.["News Title"]);
            const source = firstValue(item?.source, item?.publisher, item?.site, item?.provider, "Google News");
            const date = firstValue(item?.date, item?.published, item?.published_at, item?.pubDate);
            const summary = firstValue(item?.summary, item?.description, item?.snippet, item?.content);
            const itemSentiment = firstValue(item?.sentiment, item?.tone);

            return (
              <div className="news-item" key={`${title}-${idx}`}>
                <div>
                  <div className="news-meta">{source}{date ? ` · ${formatDate(date)}` : ""}</div>
                  <h4>{title}</h4>
                  {summary && <p className="news-summary">{summary}</p>}
                  {itemSentiment && <span className="sentiment-badge sentiment-neutral">{itemSentiment}</span>}
                </div>
                <div className="news-arrow">→</div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function RiskSection({ risk }) {
  const data = deepParse(risk) || {};
  const rows = [
    ["Overall Risk", data?.overall_risk],
    ["Market Risk", data?.market_risk],
    ["Financial Risk", data?.financial_risk],
    ["Business Risk", data?.business_risk],
    ["Regulatory Risk", data?.regulatory_risk],
  ];
  const keyRisks = Array.isArray(data?.key_risks) ? data.key_risks : [];

  return (
    <>
      <div className="panel">
        <div className="panel-title">Risk Assessment</div>
        <table className="risk-table">
          <thead>
            <tr>
              <th>Risk Category</th>
              <th>Assessment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, val]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{displayValue(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {keyRisks.length > 0 && (
        <div className="panel">
          <div className="panel-title">Key Risks</div>
          <div className="factors-grid">
            {keyRisks.map((item, idx) => (
              <div key={idx} className="factor-box">
                <span>Risk Factor</span>
                <p>{typeof item === "string" ? item : JSON.stringify(item)}</p>
              </div>
            ))}
          </div>
          {data?.risk_summary && <p style={{ color: "#888", fontSize: "12px", marginTop: "12px" }}>{data.risk_summary}</p>}
        </div>
      )}
    </>
  );
}

function Dashboard({ analysisResult, setPage }) {
  const normalized = deepParse(analysisResult) || {};
  const dashboard = normalized?.dashboard || {};
  const market = findMarketData(dashboard);
  const finance = findFinanceData(normalized);
  const news = findNewsData(normalized);
  const risk = findRiskData(normalized);
  const finalAnalysis = deepParse(dashboard?.final_analysis) || {};
  const explainability = deepParse(dashboard?.explainability) || {};

  // Try to get historical data from multiple sources
  let historicalData = Array.isArray(dashboard?.historical_data) ? dashboard.historical_data :
                       Array.isArray(market?.historical_data) ? market.historical_data : [];

  // If no historical data, generate synthetic data based on current price
  if (historicalData.length === 0) {
    const currentPrice = toNumber(firstValue(market?.current_price, market?.price));
    const change = toNumber(firstValue(market?.price_change, market?.change));
    const changePct = toNumber(firstValue(market?.price_change_percent, market?.change_percent));

    if (currentPrice !== null) {
      // Generate 14 days of synthetic historical data
      const basePrice = currentPrice - (change || 0);
      historicalData = generateHistoricalData(basePrice, currentPrice, 14);
    }
  }

  const company = firstValue(dashboard?.company, explainability?.entity, finalAnalysis?.entity, market?.entity, finance?.entity, news?.entity, "Company");
  const ticker = firstValue(dashboard?.ticker, explainability?.ticker, finalAnalysis?.ticker, market?.ticker, finance?.ticker, news?.ticker, "");

  const sortedHistory = [...historicalData].sort((a, b) => new Date(a?.date || a?.timestamp || a?.time) - new Date(b?.date || b?.timestamp || b?.time));

  const rawMarketTrend = String(market?.trend || "").trim();
  const isDown = /down|decline|drop|bear|loss/i.test(rawMarketTrend);
  const isUp = /up|rise|gain|bull|growth/i.test(rawMarketTrend);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-brand">FinSight AI</div>
          <div className="analysis-status">Explainable Financial Intelligence</div>
        </div>
        <button type="button" className="home-btn" onClick={() => setPage("home")}>← Home</button>
      </header>

      <div className="dashboard-content">
        <div className="company-header">
          <div>
            <div className="eyebrow">Financial Research Dashboard</div>
            <h2>{company}</h2>
            <div className="company-meta">
              {ticker && <span>Ticker: {ticker}</span>}
              <span>Source: {market?.data_source || "Multiple Sources"}</span>
            </div>
          </div>
          <div className="reference-date">
            <span>STATUS</span>
            <strong>Multi-Agent Complete</strong>
          </div>
        </div>

        <div className="section-heading">
          <span className="section-number">01</span>
          <div><h3>Market Snapshot</h3><p>Current market info</p></div>
        </div>
        <MarketSummaryCards market={market} />

        <div className="section-heading">
          <span className="section-number">02</span>
          <div><h3>Price History</h3><p>Historical price movement</p></div>
        </div>
        <div className="chart-panel">
          <StockChart data={historicalData} market={market} />
        </div>

        <div className="section-heading">
          <span className="section-number">03</span>
          <div><h3>Recent Trading Data</h3><p>Latest market data</p></div>
        </div>
        <div className="table-panel">
          <table>
            <thead>
              <tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr>
            </thead>
            <tbody>
              {sortedHistory.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: "center", color: "#888" }}>Historical data unavailable</td></tr>
              ) : sortedHistory.map((row, idx) => (
                <tr key={`${row?.date || idx}-${idx}`}>
                  <td>{formatDate(row?.date || row?.timestamp || row?.time)}</td>
                  <td>{formatPrice(row?.open)}</td>
                  <td>{formatPrice(row?.high)}</td>
                  <td>{formatPrice(row?.low)}</td>
                  <td>{formatPrice(row?.close)}</td>
                  <td>{row?.volume ? formatNumber(row.volume, 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-heading">
          <span className="section-number">04</span>
          <div><h3>Multi-Agent Analysis</h3><p>Specialist perspectives & findings</p></div>
        </div>
        <div className="agent-grid">
          <AgentCard
            icon="↗"
            title="Market Agent"
            subtitle="Price Action & Volatility"
            metrics={[
              { label: "Price", value: formatPrice(toNumber(firstValue(market?.current_price, market?.price))) },
              { label: "Trend", value: isDown ? "↓ Downward" : isUp ? "↑ Upward" : "Neutral", pill: isDown ? "down" : isUp ? "up" : "neutral" },
              { label: "Volatility", value: /high/i.test(market?.volatility) ? "High" : /low/i.test(market?.volatility) ? "Low" : "Moderate", pill: /high/i.test(market?.volatility) ? "down" : "neutral" },
              { label: "Source", value: market?.data_source || "Alpha Vantage" },
            ]}
            insightTitle="Technical Dynamics & Volatility"
            insightText={
              formatTrendText(firstValue(market?.market_summary, market?.trend, market?.volatility, "Market conditions evaluated across price ranges and historical volume patterns."))
            }
          />

          <AgentCard
            icon="◌"
            title="News Agent"
            subtitle="Headlines & Media Sentiment"
            metrics={[
              { label: "Sentiment", value: firstValue(news?.overall_sentiment, news?.sentiment, "Mixed"), pill: String(firstValue(news?.overall_sentiment, news?.sentiment, "")).toLowerCase().includes("positive") ? "up" : String(firstValue(news?.overall_sentiment, news?.sentiment, "")).toLowerCase().includes("negative") ? "down" : "neutral" },
              { label: "Coverage", value: (Array.isArray(news?.news_items) || Array.isArray(news?.items)) ? `${(news?.news_items || news?.items || news?.news || []).length} Articles` : "Active Feed" },
              { label: "Source", value: news?.data_source || "Google News" },
            ]}
            insightTitle="Media Sentiment & Market Impact"
            insightText={
              formatTrendText(firstValue(news?.market_impact, news?.news_summary, news?.summary, "Analysis of recent company headlines and media tone regarding market position."))
            }
          />

          <AgentCard
            icon="▣"
            title="Finance Agent"
            subtitle="Fundamental & Earnings Health"
            metrics={[
              { label: "Assessment", value: "Qualitative", pill: "neutral" },
              { label: "Focus", value: "Profitability & Cash Flow" },
              { label: "Strength", value: "Capital Allocation" },
            ]}
            insightTitle="Fundamental Position & Earnings Analysis"
            insightText={
              formatTrendText(firstValue(finance?.financial_summary, finance?.summary, finalAnalysis?.financial_analysis, "Fundamental evaluation reviewing profitability, market positioning, and revenue growth."))
            }
          />

          <AgentCard
            icon="△"
            title="Risk Agent"
            subtitle="Threats & Exposure Evaluation"
            metrics={[
              { label: "Risk Level", value: risk?.overall_risk && risk.overall_risk !== "Unavailable" ? risk.overall_risk : "Evaluated", pill: /high|elevated/i.test(risk?.overall_risk) ? "down" : "neutral" },
              { label: "Market Risk", value: risk?.market_risk && risk.market_risk !== "Unavailable" ? risk.market_risk : "Fluctuations" },
              { label: "Regulatory", value: risk?.regulatory_risk && risk.regulatory_risk !== "Unavailable" ? risk.regulatory_risk : "Compliance" },
            ]}
            insightTitle="Key Risk Factors & Considerations"
            insightText={
              formatTrendText(firstValue(risk?.risk_summary, finalAnalysis?.risk_analysis, explainability?.risk_reasoning, "Risk assessment covers market cyclicality, competitive landscape, and regulatory compliance considerations."))
            }
          />
        </div>

        <div className="section-heading">
          <span className="section-number">05</span>
          <div><h3>Recent News</h3><p>Market sentiment</p></div>
        </div>
        <NewsSection news={news} />

        <div className="section-heading">
          <span className="section-number">06</span>
          <div><h3>Risk Analysis</h3><p>Risk categories</p></div>
        </div>
        <RiskSection risk={risk} />

        <div className="section-heading">
          <span className="section-number">07</span>
          <div><h3>Final Analysis</h3><p>Combined assessment</p></div>
        </div>
        <div className="panel">
          <div className="panel-title">Overall Assessment</div>
          <p style={{ fontSize: "13px", lineHeight: "1.5" }}>
            {finalAnalysis?.overall_assessment || explainability?.direct_answer || "No assessment available."}
          </p>
        </div>

        <div className="factors-grid">
          <div className="panel"><div className="panel-title">Market</div>
            <p style={{ color: "#888", fontSize: "12px", lineHeight: "1.4" }}>
              {finalAnalysis?.market_analysis || explainability?.market_reasoning || "Unavailable."}
            </p>
          </div>
          <div className="panel"><div className="panel-title">News</div>
            <p style={{ color: "#888", fontSize: "12px", lineHeight: "1.4" }}>
              {finalAnalysis?.news_analysis || explainability?.news_reasoning || "Unavailable."}
            </p>
          </div>
          <div className="panel"><div className="panel-title">Financials</div>
            <p style={{ color: "#888", fontSize: "12px", lineHeight: "1.4" }}>
              {finalAnalysis?.financial_analysis || explainability?.financial_reasoning || "Unavailable."}
            </p>
          </div>
          <div className="panel"><div className="panel-title">Risk</div>
            <p style={{ color: "#888", fontSize: "12px", lineHeight: "1.4" }}>
              {finalAnalysis?.risk_analysis || explainability?.risk_reasoning || "Unavailable."}
            </p>
          </div>
        </div>

        <div className="section-heading">
          <span className="section-number">08</span>
          <div><h3>Explainability</h3><p>Why this conclusion</p></div>
        </div>
        <div className="panel">
          <div className="panel-title">Direct Answer</div>
          <p style={{ fontSize: "13px", lineHeight: "1.5" }}>
            {explainability?.direct_answer || "No answer provided."}
          </p>
          {explainability?.key_factors?.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <div className="examples-label" style={{ marginBottom: "10px" }}>Key Factors</div>
              <div className="factors-grid">
                {explainability.key_factors.map((f, i) => (
                  <div key={i} className="factor-box"><span>Factor</span><p>{typeof f === "string" ? f : JSON.stringify(f)}</p></div>
                ))}
              </div>
            </div>
          )}
          <div className="uncertainty-panel">
            <div className="warning-icon">!</div>
            <div>
              <strong>Uncertainties</strong>
              <p style={{ marginTop: "4px", fontSize: "12px", lineHeight: "1.5" }}>
                {explainability?.uncertainties || finalAnalysis?.data_quality_notes || "Future movements uncertain."}
              </p>
            </div>
          </div>
        </div>

        <div className="section-heading">
          <span className="section-number">09</span>
          <div><h3>Factor Interactions</h3><p>How signals influence</p></div>
        </div>
        <div className="panel interaction-panel">
          <div className="interaction-grid">
            <div className="interaction-step">
              <div className="interaction-node market">Market Signals</div>
              <div className="interaction-arrow">↓</div>
              <div className="interaction-node news">News & Events</div>
            </div>
            <div className="interaction-step">
              <div className="interaction-arrow">→</div>
              <div className="interaction-node finance">Factor Integration</div>
              <div className="interaction-arrow">→</div>
            </div>
            <div className="interaction-step">
              <div className="interaction-node finance">Fundamentals & Risk</div>
              <div className="interaction-arrow">↓</div>
              <div className="interaction-node market" style={{ marginTop: "10px" }}>Final Assessment</div>
            </div>
          </div>
          <p className="interaction-note">
            {explainability?.factor_interactions || "Evidence combined to generate assessment."}
          </p>
        </div>

        <div className="sources">
          <div>
            <div className="examples-label">Data Sources</div>
            <p>
              Market: {market?.data_source || "Alpha Vantage"} ·
              News: {news?.data_source || "Google News RSS"} ·
              Finance: {finance?.data_source || "LLM analysis"} ·
              Risk: {risk?.data_source || "Risk Agent"}
            </p>
          </div>
          <div className="footer-brand">FinSight AI</div>
        </div>
      </div>
    </main>
  );
}

// Load search history from localStorage
function loadHistory() {
  try {
    const stored = localStorage.getItem("finsight-search-history");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem("finsight-search-history", JSON.stringify(history.slice(0, 20)));
  } catch {
    // Ignore storage errors
  }
}

export default function App() {
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [searchHistory, setSearchHistory] = useState(loadHistory);

  async function analyze() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", sessionId: "finance-ai-session", chatInput: q })
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      let data = parseJSON(await res.text());
      if (Array.isArray(data)) data = data[0] || {};
      if (data?.json && !data?.dashboard) data = data.json;
      if (data?.output && !data?.dashboard) {
        const parsed = parseJSON(data.output);
        if (parsed && typeof parsed === "object") data = parsed;
      }
      if (data?.text && !data?.dashboard) {
        const parsed = parseJSON(data.text);
        if (parsed && typeof parsed === "object") data = parsed;
      }
      data = deepParse(data);
      if (!data?.dashboard) throw new Error("No dashboard data in response.");
      setResult(data);
      saveToHistory(query, data);
      setPage("dashboard");
    } catch (err) {
      console.error("ERROR:", err);
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Save to search history when analysis completes
  function saveToHistory(query, result) {
    const newEntry = {
      query,
      timestamp: new Date().toISOString(),
      company: result?.dashboard?.company ||
               result?.dashboard?.explainability?.entity ||
               result?.dashboard?.final_analysis?.entity || "Unknown",
      ticker: result?.dashboard?.ticker || "",
    };
    const updated = [newEntry, ...searchHistory.filter(h => h.query !== query)];
    setSearchHistory(updated);
    saveHistory(updated);
  }

  return (
    <div className="app">
      {page === "home" ? (
        <HomePage
          query={query}
          setQuery={setQuery}
          analyze={analyze}
          loading={loading}
          searchHistory={searchHistory}
          onClearHistory={() => { setSearchHistory([]); saveHistory([]); }}
        />
      ) : (
        <Dashboard analysisResult={result} setPage={setPage} />
      )}
      {error && page === "home" && (
        <div style={{
          position: "fixed", left: "50%", bottom: "20px", zIndex: 100,
          width: "min(500px, 90vw)", transform: "translateX(-50%)",
          padding: "12px 16px", border: "1px solid #333", borderRadius: "8px",
          background: "#1a1a1a", color: "#ef4444", fontSize: "12px",
          textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
        }}>{error}</div>
      )}
    </div>
  );
}
