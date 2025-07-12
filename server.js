import app from './app.js';
import { initializeWebSocket } from './routes/websocketRoutes.js';

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Initialize WebSocket server
initializeWebSocket(server);