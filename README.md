# Rescue Student Project  🚑

> **Autonomous AI Engineering & Code Repair Engine**  
> Built for the **Nebius × NVIDIA Global AI Hackathon** — integrating **NVIDIA Nemotron-3-Nano-30B-A3B** via **Nebius Token Factory**.

---

## 🌟 Overview

**Rescue Student Project ** helps university students, boot camp learners, and hackathon participants save broken projects before their strict deadlines. 

Unlike generic chatbots or hallucinated code assistants, Student Project Rescue:
1. **Parses the real codebase** using rigorous AST syntax audits and module resolution verification.
2. **Detects actual bugs, broken imports, missing routes, and SDK model issues** grounded in real repository evidence.
3. **Calculates a deterministic Code Health Score** derived strictly from verified file findings—never an invented or low/high guess.
4. **Dispatches deep inference to NVIDIA Nemotron-3-Nano-30B-A3B via Nebius Token Factory** to diagnose root causes and write exact search/replace code patches without truncating existing files.
5. **Verifies code fixes in an isolated sandbox** before generating a submission-ready ZIP package and readiness audit.

---

## ⚡ Nebius Token Factory × NVIDIA Nemotron Integration

### Official Hackathon Model & API Specifications
- **AI Model**: `nvidia/nemotron-3-nano-30b-a3b` (NVIDIA Nemotron-3-Nano)
- **API Endpoint**: `https://api.tokenfactory.nebius.com/v1/chat/completions`
- **Protocol**: OpenAI-compatible REST API with Bearer token authentication
- **Environment Variable**: `NEBIUS_API_KEY` (stored strictly server-side; never exposed to browser or client bundles)
- **Inference Mode**: Public shared endpoint (cost-controlled, zero dedicated instance charges)

### Dual-Engine Architecture
The application features a built-in **AI Provider Selector** in the navigation header, analysis panel, and AI workspace:
- **NVIDIA Nemotron-3-Nano-30B-A3B** (via Nebius Token Factory)
- **Google Gemini** (`gemini-flash-latest`)

Users can choose their preferred inference engine dynamically. Each analysis report, task diagnosis, and proposed code fix clearly displays which AI provider and model generated the solution.

```
                              [ Rescue Student Project  ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [ Real Source Files (.ZIP / Git) ]           [ AST Deterministic Audit ]
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                             [ Unified AI Dispatcher ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   [ Nebius Token Factory ]                            [ Google Gemini ]
   nvidia/nemotron-3-nano-30b-a3b                      gemini-flash-latest
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                           [ Verified Rescue Plan ]
                           ├── What's DONE (Evidence)
                           ├── What's BROKEN (Root Causes)
                           ├── What's MISSING (Requirements)
                           └── Actionable Repair Tasks
                                         ▼
                           [ AI Workspace & Diff Viewer ]
                           └── Search/Replace Non-Truncating Patches
                                         ▼
                           [ Isolated Sandbox Verification ]
                           └── Syntax, Manifest & Runtime Checks
                                         ▼
                           [ Final Report & ZIP Export ]
```

---

## 🛠️ Real Features & Workflow

1. **Authentication (Firebase Auth)**:
   - Secure login, sign-up, and Google Login with session persistence and project ownership isolation.
2. **Persistent Storage (Neon PostgreSQL & Drizzle ORM)**:
   - Real database storing user records, project repositories, AST analysis reports, rescue tasks, and audit logs.
3. **Repository Intake (ZIP & GitHub)**:
   - Upload full project ZIP files or import directly from public/private GitHub repositories.
4. **Pre-Analysis AST Audit (Ground Truth)**:
   - TypeScript/JavaScript AST parsing, broken HTML script check, unresolved relative imports resolution, and package dependency verification.
5. **AI Workspace with Live Diff Viewer**:
   - Compare proposed code modifications side-by-side with original files and apply changes selectively.
6. **Isolated Sandbox Verification**:
   - Bundles and compiles target entry points to verify fixes before finalizing the project.
7. **Cloudinary Snapshot Archive & Clean ZIP Download**:
   - Download the restored, verified project as a clean `.zip` archive ready for submission.

---

## 🔒 Security & Best Practices

- **Zero API Key Exposure**: `NEBIUS_API_KEY` and all backend credentials are used strictly on the Express backend (`src/server/nebius.ts`, `src/server/ai-router.ts`). No client-side code ever accesses or exposes the key.
- **Zero Synthetic Fallback**: If an AI provider call fails (e.g. rate limit or temporary outage), the app provides a detailed error message and retry mechanism. It **never** manufactures dummy or hardcoded findings.
- **Cost & Quota Protection**: Inference uses shared endpoints with exponential backoff and timeout protection to prevent runaway requests.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+ or 20+
- A Nebius Token Factory account with an active API token
- A Neon PostgreSQL database connection string

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd student-project-rescue
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your backend variables in `.env`:
```env
# Neon PostgreSQL Connection String
DATABASE_URL=postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require

# Nebius Token Factory (NVIDIA Nemotron)
NEBIUS_API_KEY=your_nebius_token_factory_api_key_here
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
NEBIUS_MODEL=nvidia/nemotron-3-nano-30b-a3b

# Google Gemini (Alternative Provider)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Authentication (Client)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **IMPORTANT**: Never commit your `.env` file or real secret keys to source control.

### 3. Run Database Migrations
```bash
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```
The application will be live at `http://localhost:3000`.

---

## 🧪 Testing the Nebius Integration

### Testing via API Endpoint
You can inspect configured AI providers via the backend status route:
```bash
curl http://localhost:3000/api/ai/providers
```

Sample JSON response:
```json
{
  "defaultProvider": "nebius",
  "providers": [
    {
      "id": "nebius",
      "name": "NVIDIA Nemotron (Nebius Token Factory)",
      "model": "nvidia/nemotron-3-nano-30b-a3b",
      "configured": true,
      "active": true,
      "badge": "NVIDIA Nemotron-3-Nano",
      "description": "Official Nebius Token Factory inference with NVIDIA Nemotron-3-Nano-30B-A3B for codebase analysis & precise code repair."
    },
    {
      "id": "gemini",
      "name": "Google Gemini",
      "model": "gemini-flash-latest",
      "configured": true,
      "active": true,
      "badge": "Gemini Flash",
      "description": "Google Gemini Flash model for static AST verification, project triage, and code repairs."
    }
  ]
}
```

### Testing in the Application UI
1. Log in or create an account with Firebase Authentication.
2. Click **Rescue New Project** and upload a ZIP archive or enter a GitHub repository URL.
3. Notice the **AI Inference Engine** selector in the top navbar or analysis view showing **NVIDIA Nemotron (Nebius)**.
4. Run the analysis: The backend sends the deterministic AST audit and repository files to `nvidia/nemotron-3-nano-30b-a3b` via Nebius Token Factory.
5. In the **AI Workspace**, click **Diagnose with NVIDIA Nemotron** on any task: Nemotron analyzes the file AST, identifies root causes, and proposes search/replace code edits.
6. Verify fixes in the sandbox and download the restored project.

---

🚀 How Nebius Token Factory Accelerated Our Workflow

Nebius Token Factory helped us integrate NVIDIA Nemotron-3-Nano-30B-A3B into Rescue Student Project through an OpenAI-compatible API, without having to manage our own model-serving infrastructure.

How We Used Nemotron

We integrated NVIDIA Nemotron-3-Nano-30B-A3B for AI-assisted software development tasks, including:

- Analyzing project context and coding requirements.
- Identifying potential code issues and their root causes.
- Generating suggested code fixes and implementation guidance.
- Supporting AI-assisted debugging and feature development.

Our application also supports Google Gemini as an alternative AI provider, allowing users to select their preferred model.

How Nebius Accelerated Development

Nebius Token Factory made it practical to connect our application to NVIDIA Nemotron using API-based inference. This allowed us to focus on building the application workflow instead of managing model deployment and serving infrastructure.

Key benefits for our development process:

- Fast Integration: Connected Nemotron through an OpenAI-compatible API.
- Simplified Infrastructure: Used a shared inference endpoint instead of deploying dedicated GPU infrastructure.
- Cost Visibility: Monitored token consumption and inference costs through the Nebius dashboard.
- Flexible Model Selection: Integrated Nemotron alongside Google Gemini.

Real Nebius Usage

We tested live inference using NVIDIA Nemotron-3-Nano-30B-A3B through Nebius Token Factory and monitored the usage dashboard.

For the selected October 29–30, 2026 reporting period, the dashboard showed:

- Input tokens: 0.35M
- Output tokens: 0.17M
- Cached tokens: 0.15M
- Total reported cost: $0.07, including VAT

This usage information helped us understand inference consumption and monitor costs while developing our AI-powered coding workflow.

Other Nebius Services

Our project uses Nebius Token Factory for model inference. We did not deploy the complete application on Nebius AI Cloud GPU instances.

Our Takeaway

Nebius Token Factory helped us bring an NVIDIA open model into a practical AI-powered developer application. It reduced the infrastructure work involved in accessing model inference and allowed us to concentrate on building a workflow that helps students understand, debug, and improve their projects before deadlines.


## 📄 License

This project is licensed under the [MIT License](LICENSE).
