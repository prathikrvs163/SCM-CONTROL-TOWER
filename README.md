# SCM Control Tower

A full-stack Supply Chain Management Control Tower for managing inventory, inbound supply, customer orders, order allocation, fulfillment exceptions, and AI-assisted operational communication.

## Overview

SCM Control Tower provides a centralized view of supply chain operations. It helps users monitor inventory across warehouses, manage inbound receipts, process customer orders, evaluate available-to-promise (ATP) quantities, and identify fulfillment risks.

The application also includes AI-powered features to summarize operational exceptions and generate customer-facing order communications.

## Features

### Master Data Management
- Create, view, update, deactivate, and reactivate SKUs.
- Manage warehouse information.
- Track active and inactive records.

### Inventory Management
- Track inventory quantities by SKU and warehouse.
- Record inventory adjustments with reasons.
- Maintain an inventory adjustment history.

### Inbound Supply
- Manage inbound receipts.
- Track receipt statuses: `PLANNED`, `IN_TRANSIT`, `RECEIVED`, and `CANCELED`.
- Update inventory when receipts are received.

### Order Management
- Create and manage customer orders and order lines.
- Track order statuses: `DRAFT`, `CONFIRMED`, `FULFILLING`, `SHIPPED`, and `CANCELED`.
- Maintain order status history.
- Support order priorities: `LOW`, `MED`, and `HIGH`.

### Available-to-Promise (ATP) and Allocation
- Calculate available inventory for customer orders.
- Plan allocations across warehouses.
- Consider inbound supply and safety-stock constraints.
- Track allocation and fulfillment progress.

### Fulfillment Exceptions
- Identify inventory shortages and fulfillment risks.
- View exception severity and affected quantities.
- Monitor operational exceptions through a centralized queue.

### AI Assistant
- Generate AI-powered exception summaries.
- Generate customer communication drafts for selected orders.
- Handle AI service errors with user-friendly messages.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| State management | Redux Toolkit, React Redux |
| Backend | NestJS, TypeScript |
| Database | MySQL 8.4 |
| ORM | Prisma 7 |
| Database adapter | Prisma MariaDB adapter |
| AI integration | Google Gemini API |
| Testing | Vitest, React Testing Library |
| Code quality | ESLint, Oxlint |
| Infrastructure | Docker Compose |

## Architecture

```text
React + TypeScript Frontend
          |
          | HTTP / REST API
          |
          v
NestJS Backend
          |
          +---- SKU Management
          +---- Warehouse Management
          +---- Inventory Management
          +---- Inbound Receipts
          +---- Customer Orders
          +---- ATP / Allocation
          +---- Fulfillment Exceptions
          +---- AI Assistant
          |
          v
       Prisma ORM
          |
          v
       MySQL 8.4

AI Assistant ----> Google Gemini API
```

## Project Structure

```text
SCM-CONTROL-TOWER/
|
+-- backend/
|   +-- prisma/
|   |   +-- migrations/
|   |   +-- schema.prisma
|   |   +-- seed.ts
|   +-- src/
|       +-- ai/
|       +-- allocation/
|       +-- exceptions/
|       +-- inbound-receipts/
|       +-- inventory/
|       +-- orders/
|       +-- prisma/
|       +-- skus/
|       +-- warehouses/
|
+-- frontend/
|   +-- src/
|       +-- app/
|       +-- components/
|       +-- features/
|       +-- hooks/
|       +-- layouts/
|       +-- pages/
|       +-- services/
|       +-- test/
|
+-- docker-compose.yml
+-- .gitignore
+-- README.md
```

## Prerequisites

Install the following before running the application:

- Node.js 24 or a compatible supported version.
- npm.
- Docker Desktop with Docker Compose.
- Git.
- A Google Gemini API key for AI functionality.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/prathikrvs163/SCM-CONTROL-TOWER.git
cd SCM-CONTROL-TOWER
```

### 2. Start MySQL using Docker Compose

From the repository root:

```bash
docker compose up -d mysql
```

The development database configuration is:

- Database: `scm_control_tower`
- Host: `localhost`
- Port: `3306`
- Root password: `scm_dev_password`

These credentials are for local development only. Replace them with secure credentials for any shared or production environment.

### 3. Configure backend environment variables

Create a file named `backend/.env`:

```env
DATABASE_URL="mysql://root:scm_dev_password@localhost:3306/scm_control_tower"
PORT=3000

GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL="gemini-3.8-flash"
```

Replace the Gemini API key with your own key.

The Gemini variables are required for AI functionality. Do not commit `.env` or expose API keys in source control.

### 4. Install backend dependencies

```powershell
cd backend
npm install
```

### 5. Generate the Prisma client and apply migrations

```powershell
npx prisma generate --config .\prisma7.config.ts
npx prisma migrate deploy --config .\prisma7.config.ts
```

These commands generate the Prisma client and apply the committed database migrations.

### 6. Seed sample data

```powershell
npm run seed
```

The seed script creates sample warehouses, SKUs, inventory balances, inbound receipts, and customer orders.

It is designed to avoid duplicating existing records. It does not reset the database or reconcile changes to records that already exist.

### 7. Start the backend

```powershell
npm run start:dev
```

Backend API:

```text
http://localhost:3000
```

### 8. Configure and start the frontend

Open another terminal:

```powershell
cd frontend
npm install
```

Optionally create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Start the frontend:

```powershell
npm run dev
```

Open the Vite development URL displayed in the terminal, normally:

```text
http://localhost:5173
```

## Testing and Quality Checks

### Backend

Run backend tests:

```powershell
cd backend
npm test
```

Run backend lint:

```powershell
npm run lint
```

Build the backend:

```powershell
npm run build
```

### Frontend

Run frontend tests:

```powershell
cd frontend
npm run test
```

Run frontend lint:

```powershell
npm run lint
```

Create a production build:

```powershell
npm run build
```

## Sample Data

The seed script provides an initial demonstration dataset:

| Entity | Sample count |
|---|---:|
| Warehouses | 3 |
| SKUs | 12 |
| Inventory balances | 36 |
| Inbound receipts | 4 |
| Customer orders | 18 (all `CONFIRMED`) |

The inbound receipts cover each lifecycle state, with arrival dates relative to the day the seed runs:

| Receipt | Warehouse | Quantity | Status | Expected arrival |
|---|---|---:|---|---|
| `DEMO-RCV-001` | `DEMO-WH-HYD` | 20 | `PLANNED` | +4 days |
| `DEMO-RCV-002` | `DEMO-WH-CHN` | 30 | `IN_TRANSIT` | +10 days |
| `DEMO-RCV-003` | `DEMO-WH-BLR` | 15 | `CANCELED` | +2 days |
| `DEMO-RCV-004` | `DEMO-WH-HYD` | 25 | `RECEIVED` | -1 day (already added to on-hand) |

The seed process skips records that already exist, making it suitable for repeated development runs without intentionally duplicating those records.

## Environment Variables

| Variable | Application | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | MySQL connection string |
| `PORT` | Backend | API server port; defaults to 3000 |
| `GEMINI_API_KEY` | Backend | Google Gemini API authentication |
| `GEMINI_MODEL` | Backend | Gemini model selection |
| `VITE_API_BASE_URL` | Frontend | Backend API base URL |

## REST API

All routes are served from `http://localhost:3000`. They are currently **unversioned** (no `/api/v1` prefix) and **unauthenticated**; both are listed under [Known Gaps](#known-gaps-and-next-steps). Request bodies are validated with a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/skus?includeInactive=true` | List SKUs |
| `GET` / `POST` / `PATCH` | `/skus`, `/skus/:id` | Read, create, update a SKU |
| `DELETE` | `/skus/:id` | Soft delete: sets `isActive = false` |
| `GET` / `POST` / `PATCH` | `/warehouses`, `/warehouses/:id` | Read, create, update a warehouse |
| `DELETE` | `/warehouses/:id` | Soft delete: sets `isActive = false` |
| `GET` | `/inventory` | On-hand balances per SKU and warehouse |
| `POST` | `/inventory/adjustments` | Increase or decrease on-hand with a required reason |
| `GET` | `/inventory/adjustments?skuId=&warehouseId=` | Adjustment history |
| `GET` / `POST` | `/inbound-receipts`, `/inbound-receipts/:id` | Read and create receipts |
| `PATCH` | `/inbound-receipts/:id` | Edit expected arrival time and/or quantity |
| `PATCH` | `/inbound-receipts/:id/status` | Move to `IN_TRANSIT` or `CANCELED` |
| `POST` | `/inbound-receipts/:id/receive` | Receive into on-hand (idempotent) |
| `GET` / `POST` | `/orders`, `/orders/:id` | Read and create orders |
| `PATCH` | `/orders/:id` | Edit a `DRAFT` order (header and lines) |
| `PATCH` | `/orders/:id/status` | Status transition (see state machine below) |
| `GET` | `/orders/:id/timeline` | Order status history |
| `GET` | `/allocation/plan` | Full allocation plan for all active orders |
| `GET` | `/allocation/atp` | Available-to-promise per SKU and warehouse over time |
| `GET` | `/exceptions?severity=&type=` | Exceptions queue |
| `POST` | `/ai/exception-summary` | AI summary of current exceptions |
| `POST` | `/ai/customer-communication/:orderId` | AI customer update draft for one order |

## Database Schema and Migrations

MySQL 8.4, accessed through Prisma 7 (`backend/prisma/schema.prisma`).

| Model | Purpose | Key constraints |
|---|---|---|
| `SKU` | Product catalog (`skuCode`, `name`, `unit`, `isActive`) | `skuCode` unique |
| `Warehouse` | Fulfillment locations (`code`, `name`, `city`, `isActive`) | `code` unique |
| `Inventory` | On-hand balance and safety stock per SKU and warehouse | Composite primary key `(skuId, warehouseId)` |
| `InventoryAdjustment` | Append-only stock movement log with a `reason` | Written for manual adjustments, receipts and shipments |
| `InboundReceipt` | Purchase order / transfer arrivals with `status`, `expectedArrivalTime`, `receivedAt` | `receiptId` unique |
| `Order` | Customer order header (`orderNumber`, `customerName`, `priority`, `requestedShipDate`, `status`) | `orderNumber` unique |
| `OrderLine` | SKU, quantity and optional preferred warehouse | Cascades on order delete |
| `OrderStatusHistory` | Every order status transition (`fromStatus`, `toStatus`, `changedAt`) | Indexed by `(orderId, changedAt)` |

Enums: `ReceiptStatus` (`PLANNED`, `IN_TRANSIT`, `RECEIVED`, `CANCELED`), `OrderPriority` (`LOW`, `MED`, `HIGH`), `OrderStatus` (`DRAFT`, `CONFIRMED`, `FULFILLING`, `SHIPPED`, `CANCELED`).

**Allocations are not stored.** They are derived on every request from persisted orders, inventory and receipts (see the next section), so there is no allocation table to drift out of sync. `Inventory.reservedQuantity` exists in the schema but is not used by the current engine.

**Migrations approach.** Schema changes are made in `schema.prisma` and captured as timestamped SQL migrations in `backend/prisma/migrations/` with `npx prisma migrate dev --config .\prisma7.config.ts`. Every environment applies the committed migrations with `npx prisma migrate deploy --config .\prisma7.config.ts`. Migrations are never edited after they are committed.

| Migration | Change |
|---|---|
| `20261112192016_init` | SKUs, warehouses, inventory |
| `20261114073020_add_inventory_adjustments` | Inventory adjustment log |
| `20261114085038_add_inbound_receipts` | Inbound receipts |
| `20261114105528_add_customer_orders` | Orders and order lines |
| `20261114110107_align_order_priority` | Priority enum aligned to `LOW` / `MED` / `HIGH` |
| `20261114190516_add_order_status_history` | Order status history |

## Allocation, ATP and Promise Rules

The engine lives in `backend/src/allocation/allocation.service.ts`. It is a **deterministic recomputation**: every call to `/allocation/plan` rebuilds the full plan from the database, in memory, with no side effects.

### Inputs

- **Demand:** orders in `CONFIRMED` or `FULFILLING`. `DRAFT`, `SHIPPED` and `CANCELED` orders consume nothing.
- **On-hand supply:** `onHandQuantity - safetyStock` per SKU and active warehouse (never below zero). Safety stock is never promised to customers.
- **Future supply:** receipts in `PLANNED` or `IN_TRANSIT`. `RECEIVED` receipts are already in on-hand and `CANCELED` receipts are ignored.
- **Planning date:** today at 00:00 UTC, so promises do not change during the day.

### Tie-breakers (who gets scarce supply first)

1. Order priority: `HIGH`, then `MED`, then `LOW`.
2. Order `createdAt`, oldest first.
3. `orderNumber`, alphabetical.

Within an order, lines are allocated in line creation order.

### Allocation order for each line

1. Warehouses are tried with the line's preferred warehouse first, then the other active warehouses by `code`.
2. In each warehouse, the line takes on-hand stock above safety stock first, then that warehouse's receipts in order of `expectedArrivalTime`, then `receiptId`.
3. If on-hand is below safety stock, incoming receipts refill that deficit before any of their quantity is promised to orders.
4. Whatever cannot be covered becomes `backorderedQuantity`. A line can be partly allocated and partly backordered.

### Promise date and reason

| Situation | `promisedShipDate` | `promiseReason` |
|---|---|---|
| Fully covered by on-hand | Planning date | "Fulfilled from available on-hand inventory." |
| Fully covered, needs inbound | Latest expected arrival of the receipts used (or the planning date, if later) | "Fulfillment depends on inbound inventory." |
| Any quantity backordered | `null` (no date is promised) | "Insufficient on-hand and inbound supply to cover the full quantity." |

A line is `isLate` when its promised date is after the order's requested ship date.

### ATP

`/allocation/atp` reports, per SKU and warehouse:

- **Available now:** `onHand - on-hand already allocated to active orders - safetyStock` (never below zero).
- **Projected availability over time:** the unallocated balance, plus each remaining receipt in arrival order, giving the ATP at each future arrival date.

### Edge cases

| Scenario | Behavior |
|---|---|
| Two orders compete for the last units of on-hand | The tie-breakers decide. The winner is allocated; the other line takes inbound supply or is backordered. The result is the same on every run. |
| Receipt ETA or quantity changes after allocations exist | Nothing is stored, so the next plan uses the new values. Promises and exceptions update automatically. |
| Receipt canceled after it was used in projections | It drops out of supply. Lines that relied on it are re-planned onto other supply or become backordered and appear in the exceptions queue. |
| Receiving the same receipt twice | The first call moves the receipt to `RECEIVED` and adds stock in one transaction. Later calls return the receipt unchanged and add nothing. |
| Two receive calls at the same moment | Each call first claims the receipt with a conditional update (`status IN (PLANNED, IN_TRANSIT)`). Only one can win; the other gets `409 Conflict`. |
| Editing a received or canceled receipt | Rejected with `400`. Only `PLANNED` and `IN_TRANSIT` receipts can change. |
| Partial allocation completed later | When a receipt is received or new stock arrives, the next plan allocates it to the backordered line. |
| Order canceled | It leaves the demand set, so its supply returns to ATP on the next plan. |
| Rapid edits / re-running allocation | Allocation has no writes, so running it any number of times cannot double-apply anything. |
| Shipping an order | `FULFILLING` to `SHIPPED` requires every line to be fully covered by on-hand. In one transaction the order is claimed (`status = FULFILLING`), stock is deducted (`onHandQuantity >= quantity` guard), and an adjustment record is written. A concurrent second ship gets `409`. |
| Concurrent status changes | All status updates are conditional on the status that was read, so a stale request gets `409` instead of overwriting. |

### Order state machine

| From | Allowed to |
|---|---|
| `DRAFT` | `CONFIRMED`, `CANCELED` |
| `CONFIRMED` | `FULFILLING`, `CANCELED` |
| `FULFILLING` | `SHIPPED`, `CANCELED` |
| `SHIPPED` | none |
| `CANCELED` | none |

Every transition is recorded in `OrderStatusHistory`. Order header and line edits are only allowed while the order is `DRAFT`.

## Exceptions Rules

The exceptions queue (`backend/src/exceptions/exceptions.service.ts`) is derived from the allocation plan on each request; it is not stored.

| Type | Raised when | Severity |
|---|---|---|
| `BACKORDER` | A line has `backorderedQuantity > 0` | `HIGH` for `HIGH`-priority orders, otherwise `MEDIUM` |
| `LATE_PROMISE` | A line's promised date is after the requested ship date | `HIGH` for `HIGH`-priority orders, otherwise `MEDIUM` |
| `INBOUND_DEPENDENCY` | A line relies on at least one inbound receipt | `LOW` |

Results can be filtered by `severity` and `type`, and are sorted by severity.

## AI Features

The app implements two AI capabilities using Google Gemini (`GEMINI_MODEL`, default `gemini-3.8-flash`), in `backend/src/ai/ai.service.ts`.

### 1. Exception summary (`POST /ai/exception-summary`)

Sends the current exceptions queue as JSON and asks for: overall situation, most critical exceptions, orders and customers at risk, supply or inventory constraints, and recommended planner actions. The prompt requires real order numbers and quantities, priority ordering (HIGH, MEDIUM, LOW), and a clear split between facts and recommendations.

### 2. Customer communication draft (`POST /ai/customer-communication/:orderId`)

Sends one order, its allocation plan line and its exceptions, and asks for a plain-text customer update (`Subject:` line, then body) addressed to the customer by name. The prompt forbids:

- inventing delivery or shipping dates, or presenting an inbound arrival date as a ship date;
- describing the allocation plan as "secured", "reserved" or "guaranteed" stock;
- saying stock fully covers the order unless no line is backordered;
- claiming the order has shipped unless its status is `SHIPPED`;
- exposing internal severity labels.

Any Markdown the model still returns (bold markers, backslash escapes) is stripped before display.

### Safety design

- **Read-only.** Both endpoints only read data. AI output never changes orders, inventory or receipts, and no message is sent to a customer. The UI labels all output as advisory and offers copy only.
- **Grounded.** A system instruction tells the model to use only the supplied data and never invent inventory, quantities, dates or commitments.
- **Secrets.** The API key comes from `backend/.env` and is redacted from every log line.
- **Bounded cost and latency.** Each AI call has a 100-second total budget. A `503` or a transient network error is retried **once**, with exponential backoff and jitter, only if at least 15 seconds would remain. `429` quota errors and `400`/`401`/`403` are never retried. The frontend waits 110 seconds, so the backend always answers first, and it ignores repeat clicks while a request is running.
- **Clear errors.** Failures return a stable `errorCode` with the HTTP status, which the UI turns into a specific message:

| `errorCode` | Status | Meaning |
|---|---|---|
| `GEMINI_QUOTA_EXHAUSTED` | 429 | Daily request quota used up |
| `GEMINI_RATE_LIMITED` | 429 | Per-minute limit reached |
| `GEMINI_UNAVAILABLE` | 503 | Provider under high demand |
| `GEMINI_TIMEOUT` | 504 | No response within the time budget |
| `GEMINI_UNREACHABLE` | 503 | Network failure reaching Gemini |
| `GEMINI_REQUEST_FAILED` | 502 | Any other provider error |

### Audit approach

Currently each AI call is logged on the server (model, attempt number, duration, status, redacted error). AI requests and responses are **not yet persisted** to the database; a dedicated AI interaction log is the first item under [Known Gaps](#known-gaps-and-next-steps).

## Tradeoffs

- **Derived allocations instead of stored ones.** Recomputing the plan on every request makes it reproducible and immune to double-applying, and receipt or order changes take effect immediately. The cost is that every plan, ATP and exceptions request reads all active orders, inventory and receipts. That is fine at demo scale but would need caching or incremental recomputation for large volumes.
- **Greedy, priority-first allocation.** Lines are filled in a fixed order, one warehouse at a time (on-hand, then that warehouse's inbound, then the next warehouse). This is easy to explain and deterministic, but it does not optimize globally. For example, a preferred warehouse's future receipt is used before another warehouse's on-hand stock.
- **Conditional updates for concurrency.** State changes use `updateMany` with the expected current status, inside transactions, rather than explicit row locks or version columns. This gives clean `409` conflicts with little code, but order edits have no stale-write check yet.
- **Draft-only order edits.** Allowing edits only before confirmation keeps allocation behavior simple, but planners cannot change confirmed orders.
- **AI as advisory text only.** Not letting AI write to the database removes a whole class of risk, at the cost of features that need a review-and-apply step.

## Known Gaps and Next Steps

Compared with the full brief, these items are not implemented yet, roughly in priority order:

1. **Audit log and AI interaction log.** A general `AuditLog` table for receipt edits, status changes and planner actions, and an `AiInteraction` table recording prompt inputs, outputs, model and user decisions.
2. **Planner actions.** Expedite a receipt (with reason), reassign a line's fulfillment location, override a promised date (with reason), and split a shipment, each writing an audit entry.
3. **Order edits after confirmation.** Defined behavior for quantity changes and line additions or deletions on `CONFIRMED` orders, with an optimistic version check.
4. **More exception types.** Detect receipts that are delayed (store the original expected arrival) or canceled under an order, and high-priority orders without enough on-hand.
5. **Richer fulfillment timeline.** A planned location column, promise reasons naming the receipt and date (for example "Waiting for inbound DEMO-RCV-001 arriving 20 Nov"), and a SKU-level supply and demand event timeline on the order detail page.
6. **Search, filters and sorting.** Date range and exception-type filters on orders, and sorting by promised date, risk and order age.
7. **AI review and confirm flow.** Edit a customer draft and save it as a "sent message" record, and per-order exception summaries ("What happened", "Current plan", "Next best actions").
8. **API versioning and authentication.** A `/api/v1` global prefix and a basic auth guard.
9. **Tests.** Unit tests for allocation, ATP and promise rules, API tests for receipt receiving, order edits and the exception lifecycle, and fixes for the scaffolded specs that lack a `PrismaService` mock.
10. **Bulk operations.** Bulk creation of receipts and orders.

Longer term: optional SKU lead time and location timezone, AI shortage insights, real-time updates, deployment and CI/CD, and centralized monitoring.

## Author

**Prathik**

GitHub: [prathikrvs163](https://github.com/prathikrvs163)

Repository: [SCM-CONTROL-TOWER](https://github.com/prathikrvs163/SCM-CONTROL-TOWER)

---

*SCM Control Tower — A full-stack supply chain operations and visibility platform.*
