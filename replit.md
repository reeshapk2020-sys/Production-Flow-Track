# Abaya Production Tracking & Inventory Management System

## Overview

This project is a full-stack, multi-user web application designed to track the entire production lifecycle of abayas, from raw fabric procurement to finished goods inventory. Its primary purpose is to provide comprehensive oversight and management capabilities for abaya manufacturing. The system aims to streamline operations, reduce manual errors, and provide real-time insights into production stages and inventory levels, ultimately improving efficiency and decision-making for manufacturers. Key capabilities include fabric roll management, cutting, allocation to stitchers (including outsourcing), receiving, finishing, and finished goods management. It also provides robust reporting and traceability features.

## User Preferences

I want iterative development.
I prefer to be asked before making major changes.
I like clear and concise explanations.

## System Architecture

The system is built as a monorepo using `pnpm workspaces`.
The backend API is developed with `Express 5` and served from `artifacts/api-server`.
The frontend is a `React` application with `Vite`, located at `artifacts/abaya-tracker`.
`PostgreSQL` is used as the database, integrated with `Drizzle ORM` for data management.
Authentication is handled via `Replit Auth` (OpenID Connect with PKCE).
Data validation is enforced using `Zod` and `drizzle-zod`.
API client code is automatically generated using `Orval` from an `OpenAPI` specification.
The UI/UX is built with `Tailwind CSS`, `shadcn/ui`, `Recharts` for data visualization, and `Lucide icons`.

**Core Production Flow:**
The system supports a detailed production flow encompassing:
1.  **Fabric Roll / Raw Material Entry**: Tracking initial material intake.
2.  **Cutting**: Managing fabric consumption and batch creation.
3.  **Allocation**: Assigning cut pieces to individual stitchers or teams, including support for `Simple Stitch` and `Outsource Required` work types.
4.  **Outsource**: Managing external processes like heat stone, embroidery, or hand stones, with send and return tracking.
5.  **Receiving from Stitchers**: Recording completed work.
6.  **Finishing**: Stages include pressing, buttons, hanger, and packing.
7.  **Finished Goods Store**: Final inventory management.

**Database Schema & Relationships:**
The database is structured with master data tables for `categories`, `sizes`, `colors`, `fabrics`, `materials`, `products`, `teams`, `stitchers`, and `app_users`. Production-specific tables include `fabric_rolls`, `purchase_orders`, `orders`, `cutting_batches`, `cutting_fabric_usage`, `allocations`, `outsource_transfers`, `receivings`, `finishing_records`, and `finished_goods`. Dispatch records are managed in the `dispatches` table. System tables (`sessions`, `users`, `audit_logs`) support core functionalities.

**User Roles & Permissions:**
The system implements a dynamic, role-based permission system. Predefined system roles like `admin`, `cutting`, `allocation`, `stitching`, `finishing`, `store`, `reporting`, `data_entry`, and `supervisor` are provided. Admins can create and manage custom roles dynamically. Permissions are granular, controlling `canView`, `canCreate`, `canEdit`, and `canImport` actions per module (`products`, `fabric-rolls`, `cutting`, `allocation`, etc.). The backend enforces these permissions via middleware, while the frontend dynamically adjusts UI elements (sidebar visibility, button states) based on user roles. An audit log tracks all create/update operations.

**Inventory & Tracking:**
The system provides real-time inventory tracking across all production stages. A composite `itemCode` (`productCode-colorCode-material1Code-material2Code`) is generated at the cutting stage for consistent identification. Inventory summaries are available for raw materials, WIP, and finished goods.

**UTC DateTime Display:**
All date/time displays use the shared `fmtUTC()` helper from `src/lib/utils.ts`. The server stores timestamps in UTC; the helper creates a "fake local" Date from UTC components so `date-fns format()` renders UTC wall-clock time regardless of the browser's timezone. Form inputs for dates/times also use ISO string slicing (`slice(0,10)` for date, `slice(11,16)` for time) instead of `toTimeString()` to avoid local-timezone shifts.

**Outsource Workflow:**
A dedicated workflow manages outsourced production, distinguishing between `simple_stitch` and `outsource_required` allocations. It tracks items sent to and returned from vendors, with validations to ensure quantity accuracy.

**Priority Order Pause Logic:**
When an Order batch is allocated to a stitcher who already has an active batch, the timing of the previous batch pauses from the Order batch's allocation time. Timing resumes when the Order batch is received/completed. The backend queries all Order-type allocations per stitcher (independent of list filters) and attaches `priorityPauses` array to each affected allocation. The frontend uses merged pause intervals (combining outsource + priority pauses) to avoid double-counting overlapping windows. Pause details (start, resume, duration) are shown in violet-themed cards in the timing popup.

**Reporting and Analytics:**
Comprehensive reports are available, including:
-   **Stitcher & Team Performance**: Metrics on issued, received, pending, rejected quantities, and efficiency.
-   **Stitcher & Team Points**: Product-wise point breakdown based on completed quantity.
-   **Daily Production**: Day-wise breakdown of production stages.
-   **Outsource Summary**: Aggregated stats and transfer details.
-   **Efficiency Report**: Time-based efficiency analysis per stitcher and team, computed from allocation-level data (expected time = points × 20 min vs actual effective time = elapsed − outsource). Shows efficiency %, performance rating (A+/A/B/C), on-time/late status, top performer highlight, and efficiency trend chart. Backend endpoint `/reports/efficiency` aggregates at allocation level first to avoid double-counting for partial receivings, then rolls up to stitcher/team/daily.
-   **Stage Pending**: Identifies bottlenecks in the production flow.
-   **Batch Status**: Provides an overview of all batches and their current stages.

**UI/UX and Interaction:**
A reusable `FilterBar` component enables filtering across all production pages by date range, dropdowns, and text search. The system includes an "Edit Lock System" where upstream records become locked for editing once downstream processes begin, with visual cues in the UI. Receiving quality checks (`hasStain`, `hasDamage`, `needsWash`, `needsRework`) are integrated into the receiving process. Bulk CSV/Excel import functionality is provided for master data, fabric rolls, cutting batches, and dispatches. The cutting import supports `itemCode`-based lookup (format: `productCode-colorCode-materialCode-material2Code`), production source linking (`Reesha`/`PO`/`Order`), and row-level validation with detailed error reporting. A `SearchableSelect` component provides searchable dropdown menus for batch/allocation selection across production pages.

**Dark Theme:**
The application supports light and dark themes via CSS custom properties. Theme toggling is managed by `ThemeProvider` (`src/lib/theme-context.tsx`) which adds/removes the `.dark` class on `<html>` and persists the preference in `localStorage`. Dark theme variables are defined in `index.css` under the `.dark` selector. All UI colors use semantic CSS variables (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-muted`, `text-muted-foreground`, etc.) instead of hardcoded Tailwind color classes. The theme toggle button (sun/moon icon) is in the top navigation header.

## External Dependencies

-   **Replit Auth**: For user authentication (OpenID Connect with PKCE).
-   **PostgreSQL**: Relational database management system.
-   **Drizzle ORM**: TypeScript ORM for database interaction.
-   **Orval**: OpenAPI client code generator.
-   **Recharts**: JavaScript charting library for data visualization.
-   **Lucide icons**: Icon set used in the UI.