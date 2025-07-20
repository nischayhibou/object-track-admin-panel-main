import { WebSocketServer } from 'ws';
import pool from '../db/index.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync(new URL('../config/config.json', import.meta.url)));
const { jwtSecret } = config.server;

let wss = null;

export const initializeWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    console.log('WebSocket client connected from:', req.socket.remoteAddress);

    // Extract token from query parameters
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    console.log('Token received:', token ? 'Yes' : 'No');

    if (!token) {
      console.log('No token provided, closing connection');
      ws.close(1008, 'Token required');
      return;
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;
      console.log('Token verified for user:', userId);

      // Store user info in WebSocket connection
      ws.userId = userId;
      ws.isAlive = true;

      // Send initial stats
      console.log('Sending initial stats for user:', userId);
      await sendInitialStats(ws, userId);

      // Set up heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          console.log('Received message:', message.type);
          await handleMessage(ws, message, userId);
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
        }
      });

      ws.on('close', (code, reason) => {
        console.log('WebSocket client disconnected. Code:', code, 'Reason:', reason);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

    } catch (error) {
      console.error('WebSocket authentication error:', error.message);
      ws.close(1008, 'Invalid token');
    }
  });

  // Set up heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('Terminating inactive WebSocket connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
};

async function sendInitialStats(ws, userId) {
  try {
    // Get active camera mappings for this user
    const activeMappings = await pool.query(`
      SELECT 
        ccmid,
        cameraid,
        objectid,
        type,
        status,
        location
      FROM camera_category_mapping 
      WHERE userid = $1 AND status = 'Active'
    `, [userId]);

    console.log(`Found ${activeMappings.rows.length} active mappings for user ${userId}`);

    // Get real-time detection counts for each active mapping
    const stats = [];
    
    for (const mapping of activeMappings.rows) {
      // Get detection counts from detections table using cameraid
      const countResult = await pool.query(`
        SELECT 
          COUNT(*) as total_detections,
          MAX(detection_time) as latest_detection,
          COUNT(CASE WHEN detection_time > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_detections,
          SUM(object_count) as total_objects,
          MAX(object_count) as max_object_count
        FROM detections 
        WHERE cameraid = $1
          AND detection_time > NOW() - INTERVAL '24 hours'
      `, [mapping.cameraid]);

      const count = countResult.rows[0];
      
      stats.push({
        mappingId: mapping.ccmid,
        cameraId: mapping.cameraid,
        objectId: mapping.objectid,
        type: mapping.type,
        location: mapping.location,
        totalDetections: parseInt(count.total_detections) || 0,
        recentDetections: parseInt(count.recent_detections) || 0,
        totalObjects: parseInt(count.total_objects) || 0,
        maxObjectCount: parseInt(count.max_object_count) || 0,
        latestDetection: count.latest_detection,
        status: mapping.status
      });
    }

    // Get overall stats for the user
    const overallStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT d.detection_id) as total_detections,
        COUNT(DISTINCT d.cameraid) as active_cameras,
        SUM(d.object_count) as total_objects,
        MAX(d.object_count) as max_object_count,
        MAX(d.detection_time) as latest_detection
      FROM detections d
      INNER JOIN camera_category_mapping ccm ON d.cameraid = ccm.cameraid
      WHERE ccm.userid = $1 
        AND ccm.status = 'Active'
        AND d.detection_time > NOW() - INTERVAL '24 hours'
    `, [userId]);

    const overall = overallStats.rows[0];

    ws.send(JSON.stringify({
      type: 'INITIAL_STATS',
      data: {
        userId: userId,
        activeMappings: activeMappings.rows.length,
        stats: stats,
        overallStats: {
          totalDetections: parseInt(overall.total_detections) || 0,
          activeCameras: parseInt(overall.active_cameras) || 0,
          totalObjects: parseInt(overall.total_objects) || 0,
          maxObjectCount: parseInt(overall.max_object_count) || 0,
          latestDetection: overall.latest_detection
        },
        timestamp: new Date().toISOString()
      }
    }));

  } catch (error) {
    console.error('Error sending initial stats:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Failed to load initial stats'
    }));
  }
}

async function handleMessage(ws, message, userId) {
  switch (message.type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG' }));
      break;

    case 'REQUEST_STATS':
      await sendInitialStats(ws, userId);
      break;

    case 'REQUEST_UPDATES':
      await sendObjectUpdates(ws, userId);
      break;

    case 'FILTER_STATS':
      await sendFilteredStats(ws, userId, message.filters);
      break;

    default:
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Unknown message type'
      }));
  }
}

async function sendObjectUpdates(ws, userId) {
  try {
    // Get recent detections for this user's cameras
    const recentDetections = await pool.query(`
      SELECT 
        d.detection_id as id,
        d.detection_time,
        d.confidence,
        d.object_count,
        d.video_filename,
        d.cameraid,
        d.category_id,
        ccm.objectid,
        ccm.type,
        ccm.status,
        ccm.location
      FROM detections d
      INNER JOIN camera_category_mapping ccm 
        ON d.cameraid = ccm.cameraid
      WHERE ccm.userid = $1 
        AND d.detection_time > NOW() - INTERVAL '1 hour'
        AND ccm.status = 'Active'
      ORDER BY d.detection_time DESC
      LIMIT 50
    `, [userId]);

    ws.send(JSON.stringify({
      type: 'OBJECT_UPDATES',
      data: recentDetections.rows.map(detection => ({
        id: detection.id,
        name: detection.objectid || 'Unknown Object',
        type: detection.type || 'Unknown Type',
        status: detection.status || 'Active',
        location: detection.location || 'Unknown',
        timestamp: detection.detection_time,
        cameraId: detection.cameraid,
        categoryId: detection.category_id,
        confidence: detection.confidence,
        objectCount: detection.object_count,
        videoName: detection.video_filename
      }))
    }));

  } catch (error) {
    console.error('Error sending object updates:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Failed to load object updates'
    }));
  }
}

async function sendFilteredStats(ws, userId, filters) {
  try {
    const { cameraId, categoryId, timeRange = '24h' } = filters;
    
    let timeFilter = '';
    switch (timeRange) {
      case '1h':
        timeFilter = "AND d.detection_time > NOW() - INTERVAL '1 hour'";
        break;
      case '6h':
        timeFilter = "AND d.detection_time > NOW() - INTERVAL '6 hours'";
        break;
      case '24h':
        timeFilter = "AND d.detection_time > NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeFilter = "AND d.detection_time > NOW() - INTERVAL '7 days'";
        break;
      default:
        timeFilter = "AND d.detection_time > NOW() - INTERVAL '24 hours'";
    }

    let whereClause = `WHERE ccm.userid = $1 ${timeFilter}`;
    let params = [userId];
    let paramIndex = 2;

    if (cameraId) {
      whereClause += ` AND d.cameraid = $${paramIndex}`;
      params.push(cameraId);
      paramIndex++;
    }

    if (categoryId) {
      whereClause += ` AND d.category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT d.detection_id) as total_detections,
        COUNT(DISTINCT d.cameraid) as active_cameras,
        COUNT(DISTINCT d.category_id) as active_categories,
        MAX(d.detection_time) as latest_detection,
        AVG(d.confidence) as avg_confidence,
        SUM(d.object_count) as total_objects,
        MAX(d.object_count) as max_object_count
      FROM detections d
      INNER JOIN camera_category_mapping ccm ON d.cameraid = ccm.cameraid
      ${whereClause}
    `, params);

    const stats = statsResult.rows[0];

    ws.send(JSON.stringify({
      type: 'FILTERED_STATS',
      data: {
        totalDetections: parseInt(stats.total_detections) || 0,
        activeCameras: parseInt(stats.active_cameras) || 0,
        activeCategories: parseInt(stats.active_categories) || 0,
        latestDetection: stats.latest_detection,
        avgConfidence: parseFloat(stats.avg_confidence) || 0,
        totalObjects: parseInt(stats.total_objects) || 0,
        maxObjectCount: parseInt(stats.max_object_count) || 0,
        filters: filters,
        timestamp: new Date().toISOString()
      }
    }));

  } catch (error) {
    console.error('Error sending filtered stats:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Failed to load filtered stats'
    }));
  }
}

// Function to broadcast updates to all connected clients
export const broadcastUpdate = async (userId, updateData) => {
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.userId === userId && client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'REAL_TIME_UPDATE',
        data: updateData
      }));
    }
  });
};

// Function to send count updates
export const sendCountUpdate = async (userId, cameraId, categoryId, count) => {
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.userId === userId && client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'COUNT_UPDATE',
        data: {
          cameraId,
          categoryId,
          count,
          timestamp: new Date().toISOString()
        }
      }));
    }
  });
}; 