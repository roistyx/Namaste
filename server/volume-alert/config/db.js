// Re-export the shared DB connection from the main Namaste server.
// connectDB() is already called by server/index.js on startup.
export { connectDB, getDB } from '../../db.js';
