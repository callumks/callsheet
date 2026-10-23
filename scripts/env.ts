// Import first in any script: loads .env.local then .env before other modules read process.env.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
