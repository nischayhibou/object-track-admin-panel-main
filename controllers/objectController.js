import { v4 as uuidv4 } from 'uuid';
import pool from '../db/index.js';
import fs from 'fs';
import Joi from 'joi';

const config = JSON.parse(fs.readFileSync(new URL('../config/config.json', import.meta.url)));
const { maxRecentObjects } = config.server;
const { table, dropdownTable } = config.database;

// Optional: validation schema
const objectSchema = Joi.object({
  id: Joi.number().allow(null).optional(),
  userId: Joi.string().required(),
  cameraId: Joi.string().required(),
  cameraURL: Joi.string().uri().required(),
  userName: Joi.string().required(),
  objectId: Joi.string().required(),
  type: Joi.string().required(),
  status: Joi.string().valid('Active', 'Inactive').default('Inactive'),
  location: Joi.string().required(),
  lastUpdatedBy: Joi.string().required()
});

export const saveObject = async (req, res) => {
  debugger;
  const { error, value } = objectSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const {
    id, userId, cameraId, cameraURL,
    userName, objectId, type,
    status = 'Inactive', location, lastUpdatedBy
  } = value;
  const lastModifiedDate = new Date();

  try {
    let query, values;
    let statusChanged = false;
    let previousStatus = null;

    if (typeof id === 'number') {
      // Check previous status
      const prev = await pool.query(`SELECT status FROM ${table} WHERE ccmid = $1`, [id]);
      previousStatus = prev.rows[0]?.status;
      statusChanged = previousStatus !== status;

      // Update existing record using ccmid as the primary key
      query = `
        UPDATE ${table}
        SET
          cameraurl = $1,
          username = $2,
          objectid = $3,
          type = $4,
          status = $5,
          location = $6,
          lastupdatedby = $7,
          lastmodifieddate = $8
        WHERE ccmid = $9
        RETURNING ccmid
      `;
      values = [
        cameraURL, userName, objectId, type,
        status, location, lastUpdatedBy, lastModifiedDate, id
      ];
    } else {
      statusChanged = true; // Always log on insert
      // Insert new record with generated ccmguid
      const ccmGuid = uuidv4();
      query = `
        INSERT INTO ${table}
          (ccmguid, userid, cameraid, cameraurl, username, objectid, type, status, location, lastupdatedby, lastmodifieddate)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING ccmguid
      `;
      values = [
        ccmGuid, userId, cameraId, cameraURL,
        userName, objectId, type, status,
        location, lastUpdatedBy, lastModifiedDate
      ];
    }

    const result = await pool.query(query, values);

    // Insert into status history if status changed or new
    if (statusChanged) {
      await pool.query(
        `INSERT INTO object_status_history (object_id, user_id, status, changed_by) VALUES ($1, $2, $3, $4)`,
        [objectId, userId, status, lastUpdatedBy]
      );
    }

    res.status(200).json({
      success: true,
      action: id ? 'updated' : 'inserted',
      recordId: result.rows[0]?.ccmid || result.rows[0]?.ccmguid
    });

  } catch (err) {
    console.error('Error saving object:', err);
    res.status(500).json({ error: 'Failed to save object' });
  }
};

export const getDropdownOptions = async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM public.${dropdownTable} ORDER BY id ASC`);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching dropdown options:', err);
    res.status(500).json({ error: 'Failed to fetch dropdown options' });
  }
};

export const getRecentObjectsByUser = async (req, res) => {
  const { userid } = req.params;
  if (!userid) return res.status(400).json({ error: 'Missing userid' });

  try {
    const { rows } = await pool.query(
      `SELECT
         CCMID AS id,
         ObjectID AS name,
         Type AS type,
         Status AS status,
         Location AS location,
         cameraId AS "cameraId",
         cameraURL AS "cameraURL",
         objectId AS "objectId",
         LastModifiedDate AS timestamp
       FROM ${table}
       WHERE UserID = $1
       ORDER BY LastModifiedDate DESC
       LIMIT $2`,
      [userid, maxRecentObjects]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching recent objects:', err);
    res.status(500).json({ error: 'Failed to fetch recent objects' });
  }
};

export const deleteObjectById = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing object ID' });

  try {
    const { rowCount, rows } = await pool.query(
      `DELETE FROM ${table} WHERE CCMID = $1 RETURNING *`,
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Object not found' });
    }

    res.status(200).json({
      message: 'Object deleted successfully',
      deleted: rows[0]
    });
  } catch (err) {
    console.error('Error deleting object:', err);
    res.status(500).json({ error: 'Failed to delete object' });
  }
};

export const getHistoryData = async (req, res) => {
  const { userid } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const cameraId = req.query.cameraId || '';
  const status = req.query.status || '';

  if (!userid) return res.status(400).json({ error: 'Missing userid' });

  try {
    let whereClause = 'u.userid = $1';
    let params = [userid];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (
        osh.object_id ILIKE $${paramIndex} OR
        osh.status ILIKE $${paramIndex} OR
        osh.changed_by ILIKE $${paramIndex} OR
        ccm.cameraid ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (cameraId) {
      whereClause += ` AND ccm.cameraid = $${paramIndex}`;
      params.push(cameraId);
      paramIndex++;
    }
    if (status) {
      whereClause += ` AND osh.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const query = `
      WITH detection_counts AS (
        SELECT 
            userid, 
            MAX(object_count) AS max_object_count
        FROM detections
        GROUP BY userid
      )
      SELECT DISTINCT ON (osh.id)
        osh.*, 
        ccm.cameraid, 
        ccm.cameraurl, 
        COALESCE(dc.max_object_count, 0) AS max_object_count
      FROM object_status_history osh
      LEFT JOIN detection_counts dc ON dc.userid = osh.user_id
      LEFT JOIN camera_category_mapping ccm ON ccm.userid = osh.user_id
      LEFT JOIN users u ON u.userid = ccm.userid
      WHERE ${whereClause}
      ORDER BY osh.id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM object_status_history osh
       LEFT JOIN camera_category_mapping ccm ON ccm.userid = osh.user_id
       LEFT JOIN users u ON u.userid = ccm.userid
       WHERE ${whereClause}`, params.slice(0, paramIndex - 1)
    );
    const total = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({ success: true, data: rows, total });
  } catch (err) {
    console.error('Error fetching history data:', err);
    res.status(500).json({ error: 'Failed to fetch history data' });
  }
};

export const getObjectStatusHistory = async (req, res) => {
  const { objectId } = req.params;
  if (!objectId) return res.status(400).json({ error: 'Missing objectId' });
  try {
    const { rows } = await pool.query(
      `SELECT id, object_id, user_id, status, changed_at, changed_by
       FROM object_status_history
       WHERE object_id = $1
       ORDER BY changed_at DESC`,
      [objectId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching status history:', err);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
};

export const getAllCameraIds = async (req, res) => {
  const { userid } = req.params;
  if (!userid) return res.status(400).json({ error: 'Missing userid' });
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT cameraid FROM camera_category_mapping WHERE userid = $1 ORDER BY cameraid`, [userid]
    );
    res.status(200).json(rows.map(r => r.cameraid));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch camera IDs' });
  }
};

export const getAllStatuses = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT status FROM object_status_history ORDER BY status`
    );
    res.status(200).json(rows.map(r => r.status));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
};