# Product Specification: AIOT - All-in-One E-commerce Tool (SaaS)

## 1. Product Vision & Market Alignment
* **Core Problem Solved:** Fragments the e-commerce testing and execution workflow by centralizing market research, creative production, and advertising management into a single high-velocity platform tailored for the MENA region.
* **Target User Personas:**
    * **MENA E-commerce Entrepreneurs:** Individuals requiring rapid testing and execution capabilities in Middle Eastern and North African markets.
    * **Digital Marketers:** Professionals managing multiple projects who need centralized marketing strategy and real-time ad performance data.
* **Unique Value Proposition:** A comprehensive, AI-powered "SOP-in-a-Box" that automates the transition from deep market research to localized creative content and automated ad optimization.

---

## 2. Functional Architecture
### 2.1 MVP Feature Set (Must-Haves)
* **Project Dashboard:** Central hub for project oversight, resource management, and campaign health monitoring.
* **Marketing SOP Engine:** A two-phase module for generating foundational research docs (Avatar, Offer, Beliefs) and strategic assets like marketing angles.
* **Creative Asset Factory:** Automated production of 8x social media posts and 4x video creatives (18-24 seconds) with localized dialect voiceovers.
* **Meta Ads Command Center:** Real-time Meta API integration with a "Color Alert" system for tracking ROAS, CPA, and CTR.
* **AI Assistant:** Integrated intelligence to aid in critical decision-making and budget reallocation.

### 2.2 Future Iterations (V2+)
* **Multi-Channel Integration:** Expansion into TikTok, Snapchat, and Google Ads management.
* **Landing Page Builder:** One-click deployment of high-converting landing pages based on selected marketing angles.
* **Logistics & COD Integration:** Tracking Cash-on-Delivery metrics alongside ad spend for real-time profitability analysis.

---

## 3. UI/UX Blueprint
* **Primary User Flow:**
    1.  **Initiation:** Create a new project for a specific product and target MENA country.
    2.  **Strategy:** Execute the Marketing SOP to generate foundational documents and 5x marketing angles.
    3.  **Production:** Select an angle to generate 8x posts and 4x videos with localized dialects.
    4.  **Execution:** Sync with Meta Ads to deploy campaigns and monitor performance via the Dashboard.
    5.  **Optimization:** React to "Red" Color Alerts using AI Assistant recommendations to adjust budgets or creatives.

* **Key Interface Views:**
    * **Executive Dashboard:** Displays Campaign Health Index (1-100), total spend, and a visual creative gallery.
    * **SOP Workspace:** Structured view for the 6-page research reports and buyer persona profiles.
    * **Advertising Command Center:** Unified interface for all active Meta campaigns with tiered color alerts.

* **Design Language & Tone:**
    * **Aesthetic:** "Mac Apple" style featuring spacious layouts, frosted glass effects, and high responsiveness.
    * **Typography:** **Cairo** font for high readability and modern sans-serif system fonts.
    * **Tone:** Premium, professional, and productivity-focused.

---

## 4. Technical Stack & Infrastructure
* **Frontend:** **Next.js 14+ (App Router)**. Recommended for its high-performance SSR capabilities, which are essential for real-time dashboard responsiveness.
* **Backend:** **Python (FastAPI)**. Ideal for orchestrating the heavy AI/LLM workflows required for the Marketing SOP and video generation scripts.
* **Database & Storage:** **PostgreSQL (via Supabase)** for structured relational data; **Redis** for caching Meta API metrics to ensure the 15-minute sync remains performant.
* **Integrations & Services:**
    * **Meta Marketing API:** Two-way communication for reading metrics and executing optimization actions.
    * **LLM (OpenAI/Gemini):** To drive the AI Assistant and generate the 6-page research documents.
    * **ElevenLabs API:** To provide localized MENA dialect voiceovers for creative videos.
    * **Hosting:** **Vercel** or **AWS** for global low-latency access in the MENA region.

---

## 5. Strategic Gap Analysis & Recommendations
* **Identified Risks:**
    * **Dialect Nuance:** Standard Arabic (Fusha) is rarely used in MENA e-commerce ads; a "dialect mismatch" between the voiceover and target region could cause user friction.
    * **Meta API Latency:** 15-minute synchronization may hit rate limits if scaling hundreds of users simultaneously.
    * **Strict Video Constraints:** The 18-24 second constraint is excellent for retention but requires high-precision AI trimming.

* **Architectural Recommendations:**
    1.  **Regional Dialect Selector:** Proactively add a specific "Dialect/Region" toggle in the project initiation workflow to ensure the Creative Module selects the correct voiceover model.
    2.  **Automated Kill-Switch:** Implement an optional "Auto-Pause" feature that automatically triggers if a campaign enters a "Red Alert" state based on the user's custom CPA/ROAS thresholds.
    3.  **Rate-Limit Proxy:** Build a caching layer for the Advertising Module to minimize direct calls to the Meta API, ensuring the UI remains snappy even during peak sync times.