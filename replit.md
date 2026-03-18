# Abaya Production Tracking & Inventory Management System

## Overview

Full-stack multi-user web application for tracking abaya manufacturing production from raw fabric rolls through to finished goods store.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/abaya-tracker)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect with PKCE)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **UI**: Tailwind CSS, shadcn/ui, Recharts, Lucide icons

## Production Flow Supported

1. Fabric Roll / Raw Material Entry
2. Cutting (with fabric roll consumption)
3. Allocation to Stitchers
4. Receiving from Stitchers
5. Finishing (Pressing → Buttons → Hanger → Packing)
6. Finished Goods Store

## Structure

```text
artifacts/
├── api-server/         # Express API server (port 8080)
│   └── src/
│       ├── routes/     # All API route handlers
│       │   ├── auth.ts           # Replit OIDC auth
│       │   ├── master.ts         # Categories, sizes, colors, fabrics, products, stitchers, teams, users
│       │   ├── fabric-rolls.ts   # Fabric roll management
│       │   ├── cutting.ts        # Cutting batch management
│       │   ├── allocation.ts     # Allocation to stitchers
│       │   ├── receiving.ts      # Receiving from stitchers
│       │   ├── finishing.ts      # Finishing stages
│       │   ├── finished-goods.ts # Finished goods store
│       │   ├── inventory.ts      # Inventory summary
│       │   ├── reports.ts        # Dashboard + all reports
│       │   └── traceability.ts   # Batch journey tracing
│       ├── lib/
│       │   ├── auth.ts           # OIDC session management
│       │   └── audit.ts          # Audit log utility
│       └── middlewares/
│           └── authMiddleware.ts # Session → req.user
└── abaya-tracker/      # React frontend (port 18354, serves at /)
    └── src/
        ├── pages/      # All application pages
        └── components/ # Shared UI components

lib/
├── api-spec/           # OpenAPI 3.1 spec + Orval config
├── api-client-react/   # Generated React Query hooks
├── api-zod/            # Generated Zod schemas
├── db/                 # Drizzle ORM schema + DB connection
│   └── src/schema/
│       ├── auth.ts     # sessions, users (Replit Auth tables)
│       └── production.ts # All production tables
└── replit-auth-web/    # Browser auth hook (useAuth)
```

## Database Schema

### Master Tables
- `categories` - Product categories
- `sizes` - Size master
- `colors` - Color master
- `fabrics` - Fabric type master
- `products` - Product/design master
- `teams` - Stitching teams
- `stitchers` - Stitcher master
- `app_users` - Application users with roles

### Production Tables
- `fabric_rolls` - Raw material / fabric roll inventory
- `cutting_batches` - Cutting batch records (with auto-generated batch numbers)
- `cutting_fabric_usage` - Links fabric rolls to cutting batches
- `allocations` - Allocation of cut pieces to stitchers
- `receivings` - Receiving records from stitchers
- `finishing_records` - Finishing stage records (pressing/buttons/hanger/packing)
- `finished_goods` - Finished goods store entries

### System Tables
- `sessions` - Replit Auth session store
- `users` - Replit Auth user profiles
- `audit_logs` - Full audit trail

## User Roles

- `admin` - Full access to everything
- `cutting` - Fabric rolls + cutting module
- `allocation` - Allocation module
- `stitching` - Receiving from stitchers
- `finishing` - Finishing stages
- `store` - Finished goods store
- `reporting` - Reports and dashboard (read-only)

## Key Features

- Full batch traceability (Fabric Roll → Cutting → Allocation → Receiving → Finishing → Finished Goods)
- Real-time inventory tracking at all stages
- Stitcher performance reports
- Dashboard with today's production metrics
- Audit log for all create/update operations
- Role-based access control with 7 levels
- Secure login via Replit Auth
- Admin-only edit access on all 6 operational modules (safe fields only — dates, operator names, remarks; quantities and foreign keys are never editable to protect inventory integrity)
- Teams and Stitchers master data with code/isActive fields, admin-only edit dialogs

## Commands

```bash
# Run dev server
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/abaya-tracker run dev

# Push DB schema
pnpm --filter @workspace/db run push

# Run codegen (after OpenAPI spec changes)
pnpm --filter @workspace/api-spec run codegen
```
