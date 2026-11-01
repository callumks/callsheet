// Import first in any script: loads .env.local then .env before other modules read process.env.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

/** Who the demo data belongs to, for seeding and screenshots. */
export const demoEmail = (process.env.DEMO_EMAIL ?? process.env.ALLOWED_EMAIL ?? "demo@callsheet.example").toLowerCase();
