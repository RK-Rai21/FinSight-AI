# FinSight AI --- Complete Project Knowledge

**Project title:** Explainable Multi-Agent LLM Framework for Intelligent
Financial Decision Support\
**Project name:** FinSight AI\
**Purpose:** A seminar/demo prototype that accepts a company or stock
question, coordinates specialist AI agents, synthesizes their findings,
and displays an explainable financial research report in a React
dashboard.

## 1. Project overview

FinSight AI demonstrates: - Multi-agent orchestration. - Separate
market, news, finance, and risk analysis. - Evidence-based synthesis. -
Explainability for non-expert users. - Structured data transfer from n8n
to a web dashboard.


## 2. Technology stack

  -----------------------------------------------------------------------
  Layer                   Technology              Role
  ----------------------- ----------------------- -----------------------
  Workflow automation     Self-hosted n8n in      Agent orchestration and
                          Docker                  integrations

  Frontend                React + Vite            Chat and dashboard

  Market data             Alpha Vantage           Daily price and
                                                  historical OHLCV

  News                    Google News RSS         Recent company news

  LLMs                    Gemini 3.5 Flash; Groq  Agent reasoning and
                          `openai/gpt-oss-120b`   synthesis

  Styling                 CSS                     Japanese garden / dark
                                                  green glass-card theme

  IDE                     VS Code on Windows      Development
  -----------------------------------------------------------------------

Local project paths and URLs: - Frontend directory:
`C:\Users\ramkr\Desktop\finance-ai-dashboard\finance-ai-dashboard` -
Frontend: `http://localhost:5173` - n8n: `http://localhost:5678` - Start
frontend with `npm run dev`.

The frontend's n8n Chat Trigger URL is:
`http://localhost:5678/webhook/f130cd63-a5e4-4560-9f2a-2bb944cf58d8/chat`

Do not publish API keys, credentials, or private webhook details in
public repositories or presentations.

## 3. System architecture

``` text
React Home / Chat
      |
      v
n8n Chat Trigger
      |
      v
Query Understanding Agent
      |
      v
Orchestrator Agent
      |
      +----------+----------+----------+
      |          |          |          |
      v          v          v          v
    Market     News       Risk       Finance
    Agent      Agent      Agent      Agent
      |          |          |          |
      +----------+----------+----------+
                     |
                     v
             Rename output fields
                     |
                     v
             Merge (4 inputs)
                     |
                     v
             Final Analysis Agent
                     |
                     v
             Explainability Agent
                     |
                     v
               Final Edit Field
                     |
                     v
             Dashboard Data Builder
                     |
                     v
        report_text + dashboard JSON
                     |
                     v
          React Financial Dashboard
```

## 4. n8n workflow details

### 4.1 Chat Trigger

-   Embedded Chat.
-   Authentication was set to None for local development.
-   Allowed origin was `http://localhost:5173`.
-   Frontend sends:

``` js
{
  action: "sendMessage",
  sessionId: "finance-ai-session",
  chatInput: query.trim()
}
```

The final n8n output uses `report_text`, not `text`, because a previous
`text` property caused the Chat Trigger to handle the result as a plain
chat response. Structured dashboard data is returned under `dashboard`.

### 4.2 Query Understanding Agent

Extracts: - `intent` - `entity` - `ticker` - `analysis_type` -
`risk_category` - `required_agents`

It interprets the question, identifies the company/ticker when possible,
classifies the request, and determines which agents are needed. The
prompt was intentionally kept mostly unchanged to avoid destabilizing
the demo. Ticker/exchange resolution remains a known limitation: do not
silently guess when a company has multiple listings.

### 4.3 Orchestrator Agent

-   Model: Groq `openai/gpt-oss-120b`.
-   Plans and coordinates agent execution.
-   Should not independently invent financial analysis.

### 4.4 Market Agent

Purpose: retrieve latest available daily market values and historical
OHLCV, then summarize price movement, trend, and volatility.

Current source: - Alpha Vantage `TIME_SERIES_DAILY`. - HTTP method:
GET. - Endpoint: `https://www.alphavantage.co/query` - Parameters:
`function=TIME_SERIES_DAILY`, ticker symbol, `outputsize=compact`, and
privately stored API key. - Ticker expression:

``` text
{{ $fromAI('ticker', 'Stock ticker symbol for Alpha Vantage', 'string') }}
```

Tool description should say it retrieves daily stock prices and
historical OHLCV for the supplied ticker. The agent must use returned
data only.

Expected output:

``` json
{
  "agent": "market",
  "entity": "",
  "ticker": "",
  "current_price": null,
  "price_change": null,
  "price_change_percent": null,
  "open": null,
  "high": null,
  "low": null,
  "volume": null,
  "trend": "",
  "volatility": "",
  "market_summary": "",
  "historical_data": [],
  "data_source": "",
  "data_quality_notes": ""
}
```

Known issue: a Tata Motors test selected US ticker `TTM`, which was not
the intended Indian listing. Exchange-aware ticker validation was
postponed. Market data may be delayed or rate-limited; show source/date
and handle errors.

### 4.5 News Agent

Purpose: retrieve relevant recent company news, summarize articles,
estimate sentiment, and explain possible market impact with uncertainty.

Google News RSS query:

``` text
https://news.google.com/rss/search?q={{$fromAI('query','Company name to search for, for example Reliance Industries','string')}}&hl=en-IN&gl=IN&ceid=IN:en
```

Expected information: news item titles, sources, dates, summaries,
sentiment, market impact, and an overall summary.

Known issue: some runs return incomplete article metadata. The frontend
should filter empty items and must not display placeholder cards such as
"Unknown source" or "News item."

### 4.6 Finance Agent

Purpose: provide concise financial fundamentals and key financial
points.

The project temporarily moved away from external finance-data APIs and
used qualitative LLM-generated analysis as a seminar fallback. Expected
schema:

``` json
{
  "agent": "finance",
  "entity": "",
  "ticker": "",
  "revenue": "Unavailable",
  "net_profit": "Unavailable",
  "profit_margin": "Unavailable",
  "debt": "Unavailable",
  "key_ratios": {
    "ROE": "Unavailable",
    "ROA": "Unavailable",
    "current_ratio": "Unavailable",
    "quick_ratio": "Unavailable",
    "debt_to_equity": "Unavailable"
  },
  "valuation": {
    "P/E": "Unavailable",
    "P/S": "Unavailable",
    "EV/EBITDA": "Unavailable",
    "P/B": "Unavailable"
  },
  "financial_summary": "",
  "data_source": "LLM qualitative analysis"
}
```

Key decisions and limitations: - User prefers **financial key points**,
not a table full of unavailable numbers. - Without verified source data,
the Finance Agent should provide concise qualitative points and
explicitly say numerical values are unavailable. - Never fabricate
revenue, net profit, debt, ratios, or valuation multiples. - An earlier
Microsoft test returned all numeric values as "Unavailable" but gave a
qualitative summary. This was a temporary fallback, not verified
financial data. - Finance Agent prompt and user message are separate n8n
fields; ensure their instructions do not conflict. - Improve the Finance
Agent to return a few specific, company-relevant, evidence-grounded key
points rather than generic praise.

### 4.7 Risk Agent

Purpose: identify company-relevant market, financial, business, and
regulatory risks.

Expected fields: - `agent`, `entity`, `ticker` - `overall_risk` -
`market_risk` - `financial_risk` - `business_risk` - `regulatory_risk` -
`key_risks` - `risk_summary`

Known issue: the agent sometimes returned generic "information
unavailable" text. Improve the prompt/context so it returns relevant,
company-specific and evidence-grounded risk points. Distinguish general
sector risks from company-specific risks. Do not invent leverage or
liquidity metrics.

### 4.8 Rename fields before Merge

Four Edit Fields nodes rename the specialist output:

  Agent     Output field
  --------- ------------------
  Market    `market_output`
  News      `news_output`
  Risk      `risk_output`
  Finance   `finance_output`

Each uses Manual Mapping, String, value `{{ $json.output }}`, and
Include Other Input Fields OFF.

### 4.9 Merge

-   Mode: Combine.
-   Combine By: Position.
-   Number of Inputs: 4.

The four distinct field names prevent collisions. Preserve this
configuration unless downstream expressions are updated and tested.

### 4.10 Final Analysis Agent

Combines the four agent results, summarizes market/news/financial/risk
findings, identifies missing or conflicting evidence, and explains
factor interactions. It must not invent facts or give BUY/SELL/HOLD
advice.

User message maps:

``` text
Finance Agent:
{{ $json.finance_output }}

Risk Agent:
{{ $json.risk_output }}

Market Agent:
{{ $json.market_output }}

News Agent:
{{ $json.news_output }}
```

Expected JSON:

``` json
{
  "entity": "",
  "ticker": "",
  "market_analysis": "",
  "news_analysis": "",
  "financial_analysis": "",
  "risk_analysis": "",
  "overall_assessment": "",
  "data_quality_notes": ""
}
```

A previous run occasionally returned `{}`. Dashboard Data Builder has a
fallback to Explainability fields.

### 4.11 Explainability Agent

Uses only the original user question and Final Analysis Agent output. It
answers directly, traces conclusions to supplied evidence, explains
positive/negative factors and interactions, and identifies uncertainty.
It must not do new research, invent facts, or give personalized advice.

Expected JSON:

``` json
{
  "entity": "",
  "ticker": "",
  "direct_answer": "",
  "key_factors": [],
  "market_reasoning": "",
  "news_reasoning": "",
  "financial_reasoning": "",
  "risk_reasoning": "",
  "factor_interactions": "",
  "uncertainties": "",
  "explanation_summary": ""
}
```

### 4.12 Final Edit Field

Formats Explainability Agent JSON into readable report text. It
should: - Parse the agent output. - Format direct answer, key factors,
market/news/financial/risk reasoning, interactions, uncertainties, and
summary. - Use fallback text for missing fields. - Never render literal
`undefined`.

### 4.13 Dashboard Data Builder

Last n8n node. Packages readable report text and structured data.

Expected top-level structure:

``` json
{
  "report_text": "",
  "dashboard": {
    "company": "",
    "ticker": "",
    "market": {},
    "historical_data": [],
    "news": {},
    "finance": {},
    "risk": {},
    "final_analysis": {},
    "explainability": {}
  }
}
```

It parses the four merged agent outputs and the Final Analysis /
Explainability outputs. It builds market metrics and historical data,
and creates fallback objects if finance/news/risk or final analysis is
missing. Keep this defensive parsing and fallback behavior.

## 5. Frontend

The app has exactly two pages:

### Page 1 --- Home / Chat

-   FinSight AI branding.
-   Chat input for a company or stock question.
-   Example prompts.
-   Sends the request to the n8n Chat Trigger.
-   On success, stores the response and navigates to the dashboard.

### Page 2 --- Financial Dashboard

Displays available structured data: - Company and ticker. - Market
metrics. - Historical price chart and trading data. - Multi-agent
cards. - News sentiment and news items. - Risk analysis. - Final
analysis. - Explainability and uncertainty. - Data sources.

A Home button returns to Page 1. Do not add more pages.

Frontend request body:

``` js
{
  action: "sendMessage",
  sessionId: "finance-ai-session",
  chatInput: query.trim()
}
```

Response parsing was designed to handle array responses and common
wrappers such as `.json`, `.output`, and `.text`. It should require a
valid `dashboard` object before rendering the dashboard and show a clear
error if it is missing.

### Visual direction

The preferred design is Japanese garden / shrine inspired: - Japanese
shrine or garden background image. - Dark forest-green translucent glass
cards. - Fine green borders. - Elegant serif headings. - Clean
sans-serif body text. - Pale green / white text. - Spacious long-form
dashboard.

A navy/blue CSS replacement previously removed this theme. Preserve the
green theme when changing CSS or JSX.

### Frontend issues previously observed

1.  `SectionTitle is not defined` caused a blank dashboard. Every
    component used must be defined or imported.
2.  Financial Fundamentals displayed only "Unavailable." User prefers
    key points rather than a full unavailable-metrics table.
3.  Finance Agent card showed "See financial analysis" for revenue/net
    profit, which was confusing.
4.  Risk Agent sometimes displayed "unavailable" for each category.
5.  News cards sometimes showed "Unknown source" / "News item." Filter
    empty items.
6.  Long text made agent cards uneven. Use responsive layout and
    wrapping.
7.  All dashboard sections must handle absent fields safely with
    optional chaining and default arrays/strings.

Do not assume a field exists. Do not reference undefined components. Do
not replace working JSX with partial fragments.

## 6. Data quality rules

-   Never invent prices, financial statements, ratios, news details, or
    risks.
-   Label qualitative LLM-generated content as qualitative.
-   Identify unavailable metrics honestly.
-   Distinguish current data from historical or delayed data.
-   Do not claim to know exact future price or timing.
-   Do not provide personalized financial advice.
-   Prefer a few useful financial key points over a large table of
    "Unavailable" values.
-   If the company/ticker is ambiguous, state the ambiguity instead of
    silently choosing the wrong listing.

## 7. Evaluation matrix

The seminar evaluation matrix uses **proposed targets**, not measured
results:

  ------------------------------------------------------------------------
  Component        Metric           Calculation            Proposed target
  ---------------- ---------------- ---------------- ---------------------
  Market Agent     Price accuracy   100 − MAPE (%)                   ≥ 95%
                                    against          
                                    reference prices 

  News Agent       Relevance        Relevant                         ≥ 80%
                   precision        retrieved        
                                    articles ÷ all   
                                    retrieved        
                                    articles × 100   

  News Agent       Sentiment        Correct                          ≥ 80%
                   agreement        sentiment labels 
                                    ÷ manually       
                                    labelled         
                                    articles × 100   

  Finance Agent    Key-point        Required                         ≥ 80%
                   coverage         checklist points 
                                    correctly        
                                    covered ÷ total  
                                    required points  
                                    × 100            

  Risk Agent       Risk coverage    Relevant                         ≥ 80%
                                    supported risk   
                                    categories       
                                    covered ÷        
                                    required         
                                    categories × 100 

  Explainability   Evidence support Supported claims                 ≥ 85%
  Agent            rate             ÷ claims checked 
                                    × 100            

  Orchestrator     Agent selection  Correct agent                    ≥ 90%
                   accuracy         selections ÷     
                                    test cases × 100 

  Workflow + UI    Execution        Successful                       ≥ 95%
                   success rate     end-to-end runs  
                                    ÷ total runs ×   
                                    100              

  Output           Valid JSON rate  Valid JSON                       ≥ 98%
                                    responses ÷      
                                    total responses  
                                    × 100            
  ------------------------------------------------------------------------

Suggested test set: - 8 query scenarios. - 3 repeated runs per
scenario. - 24 total workflow runs.

Example: 17 relevant articles out of 20 = 85% precision.\
Example: 22 successful runs out of 24 = 91.7% execution success.

### Scoring rubric

    Score Meaning
  ------- -----------------------------------------------------------
        0 Incorrect, missing, or unsupported
        1 Partially correct, with important omissions
        2 Correct, sufficiently complete, and supported by evidence

Normalized score:

``` text
(total points earned ÷ maximum possible points) × 100
```

Use the same test cases and scoring rules for all baselines and FinSight
AI. Do not present proposed targets as achieved results; calculate
actual scores from experiments.

A PowerPoint slide was generated as
`FinSight_AI_Percentage_Evaluation_Matrix.pptx`, with a white background
and green academic styling.

## 8. Current limitations and next improvements

  -----------------------------------------------------------------------
  Area                    Known limitation        Suggested next step
  ----------------------- ----------------------- -----------------------
  Ticker resolution       Wrong listing may be    Add exchange-aware
                          selected                resolution and
                                                  validation

  Finance Agent           Numeric values          Return concise
                          unavailable without     qualitative key points;
                          trusted data            later connect a
                                                  reliable finance source

  Risk Agent              Sometimes               Require
                          generic/unavailable     company-specific,
                                                  evidence-grounded risk
                                                  points

  News Agent              Article metadata may be Validate and filter
                          incomplete              title/source/date/URL

  Final Analysis          Has occasionally        Keep fallback and test
                          returned empty JSON     output consistency

  Frontend                Missing                 Safe defaults and
                          fields/components can   defined components
                          crash UI                

  Market data             Alpha Vantage can be    Show source/date and
                          delayed/rate-limited    handle API errors

  Evaluation              Targets are not actual  Run repeatable tests
                          results                 and calculate measured
                                                  scores
  -----------------------------------------------------------------------

## 9. Start and troubleshoot

### Start the project

1.  Start Docker and confirm n8n is running.
2.  Open `http://localhost:5678`.
3.  Confirm the workflow is saved and active/published as required by
    the Chat Trigger.
4.  Open a terminal in the React project directory.
5.  Run `npm run dev`.
6.  Open the Vite URL, usually `http://localhost:5173`.
7.  Keep the terminal open during development.

### Blank frontend

-   Check browser console.
-   Look for undefined components such as `SectionTitle is not defined`.
-   Verify imports and component declarations.
-   Verify `src/main.jsx` imports `App` and `index.css`.
-   Check that CSS selectors still match JSX class names.

### n8n node expression error

An error such as "There is no connection back to the node 'Market
Agent'" means an expression references a node that did not execute or is
not connected in the current execution path. Rewire the node or avoid
the invalid reference. Check execution status before using node
expressions.

### Missing dashboard data

Debug in this order: 1. Specialist agent output. 2. Rename/Edit Fields
outputs. 3. Merge output fields. 4. Final Analysis output. 5.
Explainability output. 6. Dashboard Data Builder output. 7. Browser
response parsing and dashboard field mapping.

Do not change CSS to solve missing source JSON.

## 10. Seminar explanation

> FinSight AI is an explainable multi-agent financial decision-support
> prototype. An orchestration layer coordinates specialist agents for
> market data, news sentiment, financial fundamentals, and risk
> assessment. Their outputs are merged and synthesized into a final
> analysis. An explainability agent then connects conclusions to the
> available evidence and highlights uncertainty. A React dashboard
> presents the results in a structured, user-friendly format.

It is multi-agent because each specialist has a defined role: - Market
Agent --- market prices and historical data. - News Agent --- news
retrieval and sentiment. - Finance Agent --- financial key points. -
Risk Agent --- major risk factors. - Orchestrator --- execution
planning. - Final Analysis Agent --- synthesis. - Explainability Agent
--- evidence-linked explanation.

It is explainable because it exposes key factors, reasoning by category,
factor interactions, and uncertainties rather than presenting only a
conclusion.

## 11. Rules for future changes

1.  Make one n8n change at a time and test it before moving on.
2.  Preserve working connections and the four-input Merge configuration.
3.  Never expose API keys or credentials.
4.  Never fabricate financial metrics to fill dashboard space.
5.  Prefer concise financial key points over an unavailable-metrics
    table.
6.  Filter empty news cards.
7.  Keep exactly two pages: Home/Chat and Financial Dashboard.
8.  Preserve the Japanese green visual theme.
9.  Keep agent outputs structured and parseable.
10. Clearly distinguish measured results from proposed evaluation
    targets.

## 12. Project status

**Established / implemented** - Self-hosted n8n workflow. - React + Vite
frontend. - Chat Trigger integration. - Query Understanding and
Orchestrator agents. - Market Agent using Alpha Vantage. - News Agent
using Google News RSS. - Finance and Risk agent structure. - Four
renamed outputs and four-input Merge. - Final Analysis and
Explainability stages. - Final report formatter and Dashboard Data
Builder. - Two-page frontend concept. - Japanese green visual
direction. - Percentage-based evaluation matrix slide.

**Still needs validation or improvement** - Finance Agent quality and
key-point specificity. - Risk Agent specificity and evidence quality. -
Ticker/exchange selection. - News metadata and filtering. - End-to-end
repeatability and actual evaluation scores.

**Accuracy note:** This knowledge base summarizes the project decisions
and workflow described in the conversation. Exact latest contents of the
full `App.jsx`, CSS, and every n8n prompt were not all present in the
available context, so this document describes their roles and known
requirements rather than pretending to reproduce unseen source files.
