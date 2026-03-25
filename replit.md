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

**Outsource Workflow:**
A dedicated workflow manages outsourced production, distinguishing between `simple_stitch` and `outsource_required` allocations. It tracks items sent to and returned from vendors, with validations to ensure quantity accuracy.

**Reporting and Analytics:**
Comprehensive reports are available, including:
-   **Stitcher & Team Performance**: Metrics on issued, received, pending, rejected quantities, and efficiency.
-   **Stitcher & Team Points**: Product-wise point breakdown based on completed quantity.
-   **Daily Production**: Day-wise breakdown of production stages.
-   **Outsource Summary**: Aggregated stats and transfer details.
-   **Stage Pending**: Identifies bottlenecks in the production flow.
-   **Batch Status**: Provides an overview of all batches and their current stages.

**UI/UX and Interaction:**
A reusable `FilterBar` component enables filtering across all production pages by date range, dropdowns, and text search. The system includes an "Edit Lock System" where upstream records become locked for editing once downstream processes begin, with visual cues in the UI. Receiving quality checks (`hasStain`, `hasDamage`, `needsWash`, `needsRework`) are integrated into the receiving process. Bulk CSV/Excel import functionality is provided for master data, fabric rolls, cutting batches, and dispatches. The cutting import supports `itemCode`-based lookup (format: `productCode-colorCode-materialCode-material2Code`), production source linking (`Reesha`/`PO`/`Order`), and row-level validation with detailed error reporting.

## External Dependencies

-   **Replit Auth**: For user authentication (OpenID Connect with PKCE).
-   **PostgreSQL**: Relational database management system.
-   **Drizzle ORM**: TypeScript ORM for database interaction.
-   **Orval**: OpenAPI client code generator.
-   **Recharts**: JavaScript charting library for data visualization.
-   **Lucide icons**: Icon set used in the UI.