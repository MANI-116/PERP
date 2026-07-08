# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Docker
- Use Docker to run local infrastructure (PostgreSQL, Redis) for development instead of external or installed services. Confidence: 0.70

# Git
- Do not include Co-authored-by lines in git commits. Confidence: 0.70

# TypeScript
- When running TypeScript compilation checks in a monorepo, filter out and ignore errors from unrelated apps, only report errors from the currently relevant app. Confidence: 0.80

# Configuration
- Use a config file (e.g., `config.ts` or `.env`) for API base URLs instead of hardcoding them directly in components. Confidence: 0.70

# Workflow
- Do not modify tested/running code (especially in production-like environments) without first asking for permission. Confidence: 0.70

# Code Style
- Match the existing coding style and patterns in the project; do not introduce new styling conventions when adding or modifying code. Confidence: 0.70

# Debugging
- When the user asks for debugging analysis and explicitly says "don't change the code", "just explain the reason", or "no code change", provide explanation only without suggesting or making code changes. Confidence: 0.80

# TypeScript
- Convert BigInt fields to strings via `.toString()` when returning data from engine handlers, because the engine serializes responses with `JSON.stringify()` which cannot serialize BigInt. Confidence: 0.65

# Database
- Use `Order.orderId` (the custom engine-generated ID) as the foreign key in related tables (e.g., Transaction) instead of the auto-generated `Order.id` UUID, because the engine only knows the custom orderId at order creation time. Confidence: 0.70

# UI
- Use exchange-like colors for orderbook UI: `#f23645` for asks (sell side) and `#0ecb81` for bids (buy side), similar to Binance/Backpack style. Confidence: 0.70

# Workflow
- Execute shell commands and scripts directly instead of providing copy-paste instructions; the user prefers the assistant to run commands itself when possible. Confidence: 0.80

# Workflow
- Do not delete files containing user-written code, even if they appear unused or incomplete — they may be planned features the user intends to implement later. Confidence: 0.75

# Architecture
- Use the dbPoller pattern to persist engine state snapshots to PostgreSQL rather than having the engine call the database client directly. Confidence: 0.70
- For crash recovery idempotency: (1) attach a monotonic event ID to every engine-outgoing event so downstream services compare IDs and only process if the ID is greater than last seen, (2) store this event ID in the engine snapshot, and (3) use a per-market monotonic counter appended to liquidation orders so on replay the engine can decide whether to re-run a liquidation based on the counter value. Confidence: 0.70
