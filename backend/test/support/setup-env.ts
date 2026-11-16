import { getTestDatabaseUrl } from './test-database.js';

// Point the app at the test database before any module reads the env.
// ConfigModule and dotenv never override variables that are already set.
process.env.DATABASE_URL = getTestDatabaseUrl();

// API tests must never call Gemini: with an empty key the AI endpoints
// return 503 before any request is made.
process.env.GEMINI_API_KEY = '';
