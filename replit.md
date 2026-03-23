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
3. Allocation to Stitchers (supports Simple Stitch or Outsource Required work types)
4. Outsource (Send to vendor → Return from vendor, for heat stone / embroidery / hand stones)
5. Receiving from Stitchers
6. Finishing (Pressing → Buttons → Hanger → Packing)
7. Finished Goods Store

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
- `colors` - Color master (with color code)
- `fabrics` - Fabric type master (with fabric code for item identity)
- `materials` - Material master (with code, admin-only CRUD)
- `products` - Product/design master (with design code)
- `teams` - Stitching teams
- `stitchers` - Stitcher master
- `app_users` - Application users with roles

### Production Tables
- `fabric_rolls` - Raw material / fabric roll inventory
- `cutting_batches` - Cutting batch records; stores fabricId, materialId, material2Id FKs for item identity
- `cutting_fabric_usage` - Links fabric rolls to cutting batches
- `allocations` - Allocation of cut pieces to stitchers (has `workType` and `outsourceCategory` columns)
- `outsource_transfers` - Outsource send/return tracking (allocationId, quantitySent/Returned/Damaged, vendorName, status)
- `receivings` - Receiving records from stitchers
- `finishing_records` - Finishing stage records (pressing/buttons/hanger/packing)
- `finished_goods` - Finished goods store entries

### System Tables
- `sessions` - Replit Auth session store
- `users` - Replit Auth user profiles
- `audit_logs` - Full audit trail

## User Roles

System roles (cannot be deleted):
- `admin` - Full access to everything (locked, cannot be restricted)
- `cutting` - Fabric rolls + cutting module
- `allocation` - Allocation module
- `stitching` - Receiving from stitchers
- `finishing` - Finishing stages
- `store` - Finished goods store
- `reporting` - Reports and dashboard (read-only)
- `data_entry` - Master data entry (products, colors, sizes, materials, etc.)
- `supervisor` - Full production access, view-only for reports/inventory

Custom roles can be created dynamically from the admin Permissions page.

## Permission System

- **DB table**: `role_permissions` — stores per-role, per-module permissions (canView, canCreate, canEdit, canImport); role column is `text` (not enum) to support dynamic roles
- **DB table**: `app_users` — role column is `text` (not enum) to support dynamic roles
- **Backend**: `checkPermission(module, action)` middleware in `routes/permissions.ts` — enforces permissions on all production route endpoints (GET=view, POST=create, PUT=edit, import endpoints=import)
- **Backend**: `POST/DELETE /permissions/roles` — create/delete custom roles dynamically
- **Backend**: `GET /permissions/roles` — list all roles (system + custom)
- **Frontend**: `can(module, action)` helper in auth context — controls sidebar visibility, route access, and button visibility
- **Frontend**: `getRoleLabel(role)` — returns human-readable role name (from map or auto-formatted)
- **Admin page**: `/permissions` — grid UI for admin to toggle permissions per role + create/delete custom roles
- **Modules**: products, colors, sizes, materials, teams, stitchers, fabric-rolls, cutting, allocation, outsource, receiving, finishing, finished-goods, reports, inventory
- **Actions**: view, create, edit, import
- Admin role always has all permissions (enforced in code, cannot be changed via UI)
- Default permissions seeded for all roles matching original hardcoded access patterns

## Cutting Fabric Validation

- Backend validates `quantityUsed <= roll.availableQuantity + 0.5` (tolerance of 0.5)
- Frontend shows available quantity per selected roll, warns when within tolerance, blocks when exceeding

## Inventory

- `GET /inventory/summary` — pipeline overview (raw materials, cutting WIP, stitchers, finishing stages, finished goods)
- `GET /inventory/raw-materials` — raw material breakdown grouped by fabric type and color (expandable accordion in UI)

## Allocation

- Supports both **individual** (`allocationType: "individual"`) and **team** (`allocationType: "team"`) allocation
- `allocations` table has `allocationType` (text), `teamId` (nullable FK), `stitcherId` (nullable FK)
- Backend computes `assigneeName` field in responses (stitcher name or team name based on allocation type)
- Frontend toggle between Individual/Team mode in allocation form

## Filters

- **FilterBar component** (`src/components/filter-bar.tsx`): Reusable collapsible filter bar with date range, select dropdowns, and text search fields
- Supports `type: "date" | "select" | "text"` with optional `placeholder` for text fields
- All production pages (Cutting, Allocation, Receiving, Finishing, Finished Goods) have FilterBar with relevant filters
- **Batch number search**: All production pages + Batch Status report support `batchNumber` text filter (case-insensitive partial match via `ilike`)
- All backend list endpoints support query params: `startDate`, `endDate`, `batchNumber`, plus entity-specific filters (productId, colorId, sizeId, stitcherId, teamId)
- Filter state managed locally per page component, passed to API hooks

## Outsource Workflow

- **Work Types**: `simple_stitch` (default) or `outsource_required` — set during allocation
- **Outsource Categories**: `heat_stone`, `embroidery`, `hand_stones`
- **Flow**: Allocation (marked outsource_required) → Send to vendor → Return from vendor → Receiving from stitcher
- **API Routes**: `GET /outsource` (transfers list), `GET /outsource/allocations` (outsource-type allocations), `POST /outsource/send`, `POST /outsource/return`
- **Frontend Page**: `/outsource` with 3 tabs: Send to Outsource, Return from Outsource, Transfer Log
- **Validations**: Quantity checks on send (can't exceed allocation qty), return (can't exceed pending qty), category enum enforcement, non-negative quantities

## Reports

- **Stitcher Performance**: Total issued/received/pending/rejected/efficiency per stitcher, with date range filters
- **Team Performance**: Same metrics per team (uses `/reports/team-performance` endpoint), with date/team filters
- **Daily Production**: Per-day row breakdown of cutting/allocated/received/finishing/stored quantities using SQL date series, with summary cards showing totals across range
- **Outsource Summary**: Aggregated outsource stats (total sent/returned/damaged/pending), breakdown by category, and full transfer detail table
- **Stage Pending**: Bottleneck analysis showing batches stuck per production stage
- **Batch Status**: Full overview of all batches with current stage

## Key Features

- Full batch traceability (Fabric Roll → Cutting → Allocation → Receiving → Finishing → Finished Goods)
- **Item Code system**: Composite code computed as `productCode-colorCode-material1Code-material2Code`; set at cutting time and displayed in all downstream modules
- Real-time inventory tracking at all stages
- Stitcher and team performance reports with date range filtering
- Date-wise production reports
- Dashboard with today's production metrics
- Audit log for all create/update operations
- **Dynamic role-based permission system** with per-module granularity (view/create/edit/import)
- Secure login via Replit Auth + staff login
- Permission-controlled edit access on all 6 operational modules (safe fields only — dates, operator names, remarks; quantities and foreign keys are never editable to protect inventory integrity)
- Teams and Stitchers master data with code/isActive fields, edit dialogs
- Material master module (create/edit, isActive toggle, duplicate code prevention)
- Fabric master now supports fabric code (used in item code), with edit dialog
- Bulk CSV/Excel import for all master data modules and fabric rolls
- FilterBar on all production pages for date range and entity-specific filtering

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
