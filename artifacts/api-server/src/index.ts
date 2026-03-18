import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";
import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureAdminUser() {
  try {
    const [existing] = await db
      .select({ id: appUsersTable.id, passwordHash: appUsersTable.passwordHash })
      .from(appUsersTable)
      .where(eq(appUsersTable.username, "admin"));

    const passwordHash = await bcrypt.hash("Admin@1234", 12);

    if (!existing) {
      await db.insert(appUsersTable).values({
        username: "admin",
        fullName: "Administrator",
        passwordHash,
        role: "admin",
        isActive: true,
      });
      console.log("Admin user created successfully.");
    } else if (!existing.passwordHash) {
      await db
        .update(appUsersTable)
        .set({ passwordHash, isActive: true, role: "admin" })
        .where(eq(appUsersTable.id, existing.id));
      console.log("Admin password hash set.");
    } else {
      console.log("Admin user already exists.");
    }
  } catch (err) {
    console.error("ensureAdminUser error:", err);
  }
}

ensureAdminUser().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
