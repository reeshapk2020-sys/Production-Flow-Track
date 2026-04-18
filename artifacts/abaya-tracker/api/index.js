// Import your app from the api-server folder (one level up)
import app from "../api-server/src/app.js";

// Admin setup code
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";

async function setupAdmin() {
  try {
    const [existing] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.username, "admin"));

    if (!existing) {
      const passwordHash = await bcrypt.hash("Admin@1234", 12);
      await db.insert(appUsersTable).values({
        username: "admin",
        fullName: "Administrator",
        passwordHash,
        role: "admin",
        isActive: true,
      });
      console.log("Admin user created");
    }
  } catch (err) {
    console.error("Admin setup error:", err);
  }
}

setupAdmin();
export default app;
