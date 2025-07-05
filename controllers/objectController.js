import { v4 as uuidv4 } from 'uuid';
import pool from '../db/index.js';
import fs from 'fs';
import Joi from 'joi';
import { Console } from 'console';

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

    if (typeof id === 'number') {
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