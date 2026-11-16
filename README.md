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
| Customer orders | 18 |

The seed process skips records that already exist, making it suitable for repeated development runs without intentionally duplicating those records.

## Environment Variables

| Variable | Application | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | MySQL connection string |
| `PORT` | Backend | API server port; defaults to 3000 |
| `GEMINI_API_KEY` | Backend | Google Gemini API authentication |
| `GEMINI_MODEL` | Backend | Gemini model selection |
| `VITE_API_BASE_URL` | Frontend | Backend API base URL |

## Development Notes

- The backend uses NestJS modules to separate supply chain capabilities.
- Prisma manages database access and migrations.
- Inventory-changing operations should preserve transactional consistency.
- Order allocation considers inventory availability and safety-stock constraints.
- AI-generated customer communications are drafts and should be reviewed before sending.
- Environment files and generated build artifacts should not be committed.

## Future Improvements

Potential areas for further development:

- Authentication and role-based access control.
- Real-time inventory and fulfillment updates.
- Advanced demand forecasting.
- Supplier performance analytics.
- Automated replenishment recommendations.
- Cloud deployment and CI/CD automation.
- Observability, monitoring, and centralized logging.

## Author

**Prathik**

GitHub: [prathikrvs163](https://github.com/prathikrvs163)

Repository: [SCM-CONTROL-TOWER](https://github.com/prathikrvs163/SCM-CONTROL-TOWER)

---

*SCM Control Tower — A full-stack supply chain operations and visibility platform.*