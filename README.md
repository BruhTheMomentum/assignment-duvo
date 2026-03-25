# Agentic Platform

A Next.js chat application powered by the [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) with tool-use capabilities. Claude can fetch web data, export CSV files, and interact with Google Workspace (Drive, Docs, Sheets, Slides, Calendar) through MCP servers.

## Implementation Progress

### Step 1 -- The Basics

Chat interface built with Next.js 16 Server Actions and the Claude Agent SDK. Users send instructions, Claude responds via a streaming agentic loop. Sessions persist in localStorage with history navigation.

### Step 2 -- Doing Something Useful

Two tools enable data workflows:
- **WebFetch** (built-in SDK tool) fetches content from any URL
- **save_csv** (custom MCP tool) receives structured `{ headers, rows }` JSON from Claude and builds a proper CSV with quote escaping

The system prompt instructs Claude to fetch data with WebFetch, flatten nested JSON, and call `save_csv`. The CSV is captured via a closure in the tool handler and returned to the client as a Blob download link.

### Step 3 -- Observable Automation

A step timeline renders below each assistant message, showing every action Claude took:
- **Assistant text** -- Claude's reasoning and planning
- **Tool calls** -- which tool was invoked with what input (expandable JSON)
- **Tool results** -- success/error output from each tool (color-coded, collapsible)

Steps are extracted from the SDK's `assistant` and `user` message stream events in real-time.

### Step 4 -- Connecting Your Data

Per-user Google Workspace integration via `@piotr-agier/google-drive-mcp`:
- OAuth 2.0 web flow (consent screen, token exchange, secure cookie-based user identity)
- Tokens stored server-side in `.data/tokens/{userId}.json`
- MCP server spawned as a stdio subprocess per chat request with the user's credentials
- "Connect Google" / "Google Connected" UI with one-click disconnect
- System prompt dynamically updated when Google tools are available

Supports: Google Drive, Docs, Sheets, Slides, and Calendar.

### Step 5 -- Evaluating the Job (Partial)

Type system scaffolded for a dual evaluation model:
- **Self-evaluation** -- `SelfEvaluation` type with status (`complete` / `partial` / `failed`), summary, issues, and confidence score
- **Judge evaluation** -- `JudgeEvaluation` type with verdict (`pass` / `partial` / `fail`), score, reasoning, and gaps

**Not yet implemented:** the actual evaluation logic (second LLM call after task completion) and the UI to display results. The `evaluation` field is wired through `ChatState` and `ChatMessage` but currently returns `null`.

## Features

- **Chat with Claude** -- conversational UI with session history (localStorage)
- **WebFetch tool** -- Claude can fetch and analyze content from URLs
- **CSV export** -- structured data exported via a custom MCP tool, downloadable from the UI
- **Google Workspace** -- per-user OAuth connects Drive, Docs, Sheets, Slides, and Calendar
- **Step timeline** -- visualizes Claude's tool calls, inputs, and results in real-time
- **Evaluation types** -- scaffolded for dual self-eval + judge scoring (not yet implemented)

## Tech Stack

- Next.js 16 (App Router, Server Actions)
- React 19, TypeScript 5
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- Google Drive MCP (`@piotr-agier/google-drive-mcp`)
- Tailwind CSS 4, shadcn components

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Install and run

```bash
npm install
cp .env.example .env  # add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `GOOGLE_CLIENT_ID` | For Google | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | For Google | OAuth 2.0 client secret |
| `NEXT_PUBLIC_APP_URL` | No | App base URL (defaults to `http://localhost:3000`) |

## Google Workspace Setup

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com)
2. Enable APIs: Drive, Docs, Sheets, Slides, Calendar
3. Configure OAuth consent screen (External, add your email as test user)
4. Create OAuth 2.0 credentials (**Web application** type)
   - Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`
6. Click "Connect Google" in the app UI

Tokens are stored server-side in `.data/tokens/` (gitignored, per-user).

## Architecture

```
app/
  actions.tsx               # Server actions: chat, Google status/disconnect
  page.tsx                  # Home page with session management
  types.ts                  # TypeScript types
  lib/
    google-auth.ts          # OAuth helpers, token I/O
  api/auth/google/
    route.ts                # GET -> redirect to Google consent
    callback/route.ts       # GET -> exchange code, save tokens
  components/
    chat.tsx                # Chat UI with message bubbles
    google-connect.tsx      # Connect/disconnect Google button
    step-timeline.tsx       # Tool execution visualization
```

### How it works

1. User sends a message via the chat form (server action)
2. `chat()` in `actions.tsx` creates an in-process MCP server for CSV export
3. If the user has Google tokens, a stdio MCP server (`@piotr-agier/google-drive-mcp`) is spawned with their credentials
4. Claude receives the message + available tools and responds, potentially making tool calls across multiple turns
5. Tool call steps are captured from the stream and displayed in the step timeline
6. CSV data is captured via a closure and returned for client-side Blob download

### MCP Servers

| Server | Type | Tools |
|---|---|---|
| `csv-tools` | In-process (SDK) | `save_csv` — structured data to CSV |
| `google-drive` | Stdio (subprocess) | Drive search, file ops, Docs/Sheets/Slides editing, Calendar |

Both are passed to `query()` via `options.mcpServers`. The SDK auto-discovers tools from MCP servers.

## Project Structure

```
.
├── app/
│   ├── actions.tsx
│   ├── page.tsx
│   ├── layout.tsx
│   ├── types.ts
│   ├── globals.css
│   ├── lib/
│   ├── api/
│   └── components/
├── components/ui/          # shadcn components (Button, Card, Textarea)
├── lib/utils.ts            # cn() helper
├── .data/                  # User tokens (gitignored)
├── next.config.ts
└── package.json
```
