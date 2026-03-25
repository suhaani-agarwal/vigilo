# Vigilo – Your AI-Powered Compliance Guardian

## Overview

**Tired of drowning in endless paperwork and chasing compliance deadlines?**  
Vigilo is here to change that. No more missed deadlines. No surprise penalties. Just seamless, automated compliance.

Vigilo is an agentic AI compliance assistant that continuously monitors official regulatory sources (e.g., FSSAI, SEBI, IT Acts) and draft bills, interprets changes in plain language, and maps them to your company’s real context using RAG and vector matching. It generates clear action items and checklists, triggers automated workflows via your existing systems, and maintains an audit-ready evidence trail. A customizable dashboard highlights risk, impact, and deadlines so teams catch changes early and stay compliant in real time.

## Key Features

1. **Proactive Regulation Scanning**

   - Vigilo monitors portals like RBI, SEBI, FSSAI, IRDAI, and more — delivering real-time, company-specific compliance updates from draft bills and regulatory bodies.
   - Notifies companies of upcoming changes before enforcement deadlines.

2. **AI-Powered Summarisation & Interpretation**

   - Converts complex legal jargon into easy-to-understand summaries.
   - Provides clear, actionable insights tailored to business needs.

3. **Automated Compliance Actions**

   - Smart workflows trigger tasks, checklists, or policy updates automatically.

4. **Customisable Regulatory Dashboard**

   - Sector-specific filters (finance, marketing, sales, legal, etc.).
   - Risk-level indicators (High / Medium / Low urgency).

5. **Audit-Ready Compliance Logs**
   - Maintains detailed evidence trails for audits.
   - Reduces preparation time & ensures transparency.

## Technical Workflow – How Vigilo Works

1. **Industry Selection & Ingestion**

   - User selects their industry (Finance, Food, Pharma, IT, etc.).
   - Based on this, Vigilo shows the required regulators and compliance documents.

2. **Amendment Intelligence**

   - Continuously web-scrapes official portals (e.g., FSSAI for food, SEBI for finance, IT Acts for tech) and fetches only industry-relevant regulations based on the company profile.
   - Stores updates as vector embeddings; RAG later retrieves the most relevant context for analysis and summaries.

3. **Relevance Check**

   - Cross-matches amendments against policies, product designs, and labels to detect non-compliance risks.

4. **Layered AI Analysis (Prompt Chain)**

- Model 1: Retrieves the latest amendments from the vector DB, breaks down large PDFs into chunks, and summarizes them.
- Model 2: Analyzes company profile, category, and workflows → filters amendments that might impact the company.
- Model 3–5: Examines different company documents (labels, ads, HR files, contracts, etc.) to check compliance with the filtered amendments. Number of models depends on document types provided.
- Model 6: Aggregates insights and generates a comprehensive compliance report, highlighting required actions, deadlines, and risks.
- Reports are delivered to the frontend via FastAPI, displayed in a clear dashboard for easy decision-making.

5. **Proactive Alerts**
   - Real-time notifications via **MCP + Gmail API**.
   - Ensures no compliance deadlines are missed.

## Tech Stack

### 1. AI & Automation

- **LLMs**: GPT OSS / DeepSeek-r1-distill-LLaMA-70B / LLaMA models – Legal document summarization & interpretation
- **RAG**: Vector DBs (FAISS, Chroma) – Retrieve regulations & insights
- **MCP (Model Context Protocol)** – Bridge to APIs & notifications
- **LangChain / AutoGen** – Multi-agent orchestration

### 2. Backend & Processing

- Python / Node.js – Core logic & API integration
- FastAPI – Lightweight backend

### 3. Data Sources & Integration

- Government portals (web scraping) – Real-time regulatory updates
- Firebase – Compliance history & audit logs

### 4. Frontend & UX

- Next.js – Compliance monitoring dashboard
- TailwindCSS – Clean, professional UI

## ⚙️ Setup Instructions

```bash
# Clone the repo
git clone https://github.com/yourusername/vigilo.git
cd vigilo

# Install dependencies
npm install

# Run development server
npm run dev

# Backend setup
cd backend

# Install backend dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 5005 --reload

# Add the following to .env.local (in the root directory)
GROQ_API_KEY=your-api-key
CHROMA_DIR=./chroma_db
NEXT_PUBLIC_URL=http://localhost:5005

```
