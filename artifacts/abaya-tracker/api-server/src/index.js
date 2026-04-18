import app from "../api-server/src/app.js";

// Your admin user creation needs to run here
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";

// Run admin setup on first request
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
      console.log("Admin created");
    }
  } catch (err) {
    console.error("Admin setup error:", err);
  }
}

// Run setup (won't block the response)
setupAdmin();

// That's it - just export your app
export default app;
