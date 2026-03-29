# API Reference

Sandbox/Thread runtime with AI SDK compatible streaming.

## Sandboxes

A sandbox is a persistent runtime environment with its own filesystem, git state, and sessions. All endpoints require `Authorization: Bearer <api_key>` header.

### Create Sandbox

POST https://relay.an.dev/v1/sandboxesRequired: `agent` (slug). Optional: `files`, `envs`, `setup` — these override/extend the agent's deployed sandbox config.

```
// POST /v1/sandboxes
{
  "agent": "my-agent",
  "files": { "/home/user/workspace/config.json": "{\"key\": \"value\"}" },
  "setup": ["npm install -g prettier"]
}

// Response
{
  "id": "sb_abc123",
  "sandboxId": "e2b-sandbox-id",
  "status": "active",
  "createdAt": "2026-02-26T12:00:00Z"
}
```

### Get Sandbox

GET https://relay.an.dev/v1/sandboxes/:id```
// GET /v1/sandboxes/:id

// Response
{
  "id": "sb_abc123",
  "sandboxId": "e2b-sandbox-id",
  "status": "active",
  "error": null,
  "agent": { "slug": "my-agent", "name": "My Agent" },
  "threads": [
    { "id": "th_xyz789", "name": "Chat 1", "status": "completed" }
  ],
  "createdAt": "2026-02-26T12:00:00Z",
  "updatedAt": "2026-02-26T12:05:00Z"
}
```

### Delete Sandbox

DELETE https://relay.an.dev/v1/sandboxes/:id```
// DELETE /v1/sandboxes/:id

// Response: 204 No Content
```

Deletes the sandbox and cascades deletion to all threads within it.

## Sandbox Operations

Run commands, read/write files, and clone repos inside a sandbox.

### Execute Command

POST https://relay.an.dev/v1/sandboxes/:id/exec```
// POST /v1/sandboxes/:id/exec
{
  "command": "ls -la /home/user/workspace",
  "cwd": "/home/user/workspace/repo",
  "envs": { "NODE_ENV": "production" },
  "timeoutMs": 30000
}

// Response
{
  "stdout": "total 24\ndrwxr-xr-x 5 user user 4096 ...",
  "stderr": "",
  "exitCode": 0
}
```

### Write Files

POST https://relay.an.dev/v1/sandboxes/:id/files```
// POST /v1/sandboxes/:id/files
{
  "files": [
    { "path": "/home/user/workspace/hello.txt", "content": "Hello world!" },
    { "path": "/home/user/workspace/config.json", "content": "{\"key\": \"value\"}" }
  ]
}

// Response: 200 OK
```

### Read File

GET https://relay.an.dev/v1/sandboxes/:id/files?path=...```
// GET /v1/sandboxes/:id/files?path=/home/user/workspace/hello.txt

// Response
{
  "path": "/home/user/workspace/hello.txt",
  "content": "Hello world!"
}
```

### Clone Repository

POST https://relay.an.dev/v1/sandboxes/:id/git/clone```
// POST /v1/sandboxes/:id/git/clone
{
  "url": "https://github.com/org/repo.git",
  "path": "/home/user/workspace/repo",
  "token": "ghp_...",
  "depth": 1
}

// Response
{
  "path": "/home/user/workspace/repo",
  "branch": "default"
}
```

For private repos, pass a `token` (e.g. GitHub PAT). Use `depth: 1` for faster shallow clones.

## Threads

A thread is a conversation within a sandbox. Each thread has its own message history, status, and cost tracking.

### List Threads

GET https://relay.an.dev/v1/sandboxes/:id/threads```
// GET /v1/sandboxes/:id/threads

// Response
[
  {
    "id": "th_xyz789",
    "name": "Chat 1",
    "status": "completed",
    "createdAt": "2026-02-26T12:00:00Z",
    "updatedAt": "2026-02-26T12:05:00Z"
  }
]
```

### Create Thread

POST https://relay.an.dev/v1/sandboxes/:id/threads```
// POST /v1/sandboxes/:id/threads
{
  "name": "Chat 1"
}

// Response
{
  "id": "th_xyz789",
  "name": "Chat 1",
  "status": "active",
  "createdAt": "2026-02-26T12:00:00Z"
}
```

### Get Thread

GET https://relay.an.dev/v1/sandboxes/:id/threads/:threadId```
// GET /v1/sandboxes/:id/threads/:threadId

// Response
{
  "id": "th_xyz789",
  "name": "Chat 1",
  "status": "completed",
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there!" }
  ],
  "createdAt": "2026-02-26T12:00:00Z",
  "updatedAt": "2026-02-26T12:05:00Z"
}
```

### Delete Thread

DELETE https://relay.an.dev/v1/sandboxes/:id/threads/:threadId```
// DELETE /v1/sandboxes/:id/threads/:threadId

// Response: 204 No Content
```

## Chat Endpoint

POST https://relay.an.dev/v1/chat/:slug**Body `sandboxId` + `threadId`:** continue an existing thread in a sandbox.

**Body `sandboxId` only:** creates a new thread in the existing sandbox.

**No sandbox/thread:** creates a new sandbox and a new thread automatically.

**Body `options`:** optional per-request runtime overrides such as `systemPrompt`, `maxTurns`, `maxBudgetUsd`, and `disallowedTools`.

**`threadId` without `sandboxId`:** returns a 400 error.

## Resuming & Cancelling

```
GET  https://relay.an.dev/v1/chat/:slug/:sandboxId/stream
DELETE https://relay.an.dev/v1/chat/:slug/:sandboxId/stream
```

Use the sandbox ID in the URL to resume or cancel an active stream. Use `DELETE .../stream` for deterministic server-side cancel.

## Request Body

`options` overrides the deployed agent config for this request only. The runtime currently applies `systemPrompt`, `maxTurns`, `maxBudgetUsd`, and `disallowedTools`.

```
{
  "sandboxId": "uuid-of-existing-sandbox",
  "threadId": "uuid-of-existing-thread",
  "options": {
    "systemPrompt": {
      "type": "preset",
      "preset": "claude_code",
      "append": "Focus on regressions, risky edge cases, and missing tests. Do not edit files."
    },
    "maxTurns": 4,
    "maxBudgetUsd": 0.2,
    "disallowedTools": ["Bash"]
  },
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Your message" }]
    }
  ]
}
```

## SSE Response

```
data: {"type":"start"}
data: {"type":"text-start","id":"..."}
data: {"type":"text-delta","id":"...","delta":"Hello world"}
data: {"type":"text-end","id":"..."}
data: {"type":"message-metadata","messageMetadata":{
  "sessionId":"...",
  "totalCostUsd":0.034,
  "inputTokens":3,
  "outputTokens":5,
  "durationMs":2487
}}
data: {"type":"finish"}
data: [DONE]
```

## cURL

```
curl -N -X POST https://relay.an.dev/v1/chat/YOUR_AGENT_SLUG \
  -H "Authorization: Bearer an_sk_96420df2536963f8562d006b5cbffd456fd34060018d261b50a28af1a0ff0d38" \
  -H "Content-Type: application/json" \
  -d '{
    "sandboxId": "uuid-of-existing-sandbox",
    "threadId": "uuid-of-existing-thread",
    "options": {
      "systemPrompt": {
        "type": "preset",
        "preset": "claude_code",
        "append": "Focus on regressions, risky edge cases, and missing tests. Do not edit files."
      },
      "maxTurns": 4,
      "maxBudgetUsd": 0.2,
      "disallowedTools": ["Bash"]
    },
    "messages": [{
      "id": "msg-1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Hello" }]
    }]
  }'
```

## React (SDK)

For the recommended approach using @21st-sdk/nextjs with server-side token exchange, see the Get Started guide.## Server SDK

Runtime SDK examples for sandboxes, threads, runs, files, git, and tokens live on the Server SDK page.## React (raw AI SDK)

Direct usage with AI SDK — useful for custom transports or non-Next.js frameworks.

agent-chat.tsx
```tsx
import { Chat, DefaultChatTransport } from "ai"
import { useChat } from "@ai-sdk/react"

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "https://relay.an.dev/v1/chat/YOUR_AGENT_SLUG",
    headers: async () => ({
      Authorization: "Bearer an_sk_96420df2536963f8562d006b5cbffd456fd34060018d261b50a28af1a0ff0d38",
    }),
    body: {
      sandboxId: "uuid-of-existing-sandbox",  // optional
      threadId: "uuid-of-existing-thread",     // optional
    },
  }),
})

const releaseReviewOptions = {
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "Focus on regressions, risky edge cases, and missing tests. Do not edit files.",
  },
  maxTurns: 4,
  maxBudgetUsd: 0.2,
  disallowedTools: ["Bash"],
}

export function AgentChat() {
  const { messages, sendMessage } = useChat({ chat })

  return (
    <div>
      {messages.map((m) => <div key={m.id}>{m.content}</div>)}
      <button
        onClick={() =>
          sendMessage(
            { text: "Review the checkout flow before release." },
            { body: { options: releaseReviewOptions } },
          )
        }
      >
        Run review
      </button>
    </div>
  )
}
```