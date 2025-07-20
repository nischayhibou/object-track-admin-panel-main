#!/usr/bin/env node

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

console.log('🗄️  Initializing Database...\n');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

const initQueries = [
  // Create extensions
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,

  // Create users table
  `CREATE TABLE IF NOT EXISTS users (
    userid SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    username VARCHAR(30) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(10) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Create camera_category_mapping table
  `CREATE TABLE IF NOT EXISTS camera_category_mapping (
    ccmid SERIAL PRIMARY KEY,
    ccmguid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    userid VARCHAR(255) NOT NULL,
    cameraid VARCHAR(255) NOT NULL,
    cameraurl TEXT NOT NULL,
    username VARCHAR(255) NOT NULL,
    objectid VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Inactive',
    location VARCHAR(255) NOT NULL,
    lastupdatedby VARCHAR(255) NOT NULL,
    lastmodifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Create dropdown_options table
  `CREATE TABLE IF NOT EXISTS dropdown_options (
    id SERIAL PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL
  );`,

  // Insert default dropdown options
  `INSERT INTO dropdown_options (value, label, category) VALUES 
    ('person', 'Person', 'object_type'),
    ('car', 'Car', 'object_type'),
    ('truck', 'Truck', 'object_type'),
    ('bicycle', 'Bicycle', 'object_type'),
    ('motorcycle', 'Motorcycle', 'object_type'),
    ('bus', 'Bus', 'object_type'),
    ('train', 'Train', 'object_type'),
    ('boat', 'Boat', 'object_type'),
    ('airplane', 'Airplane', 'object_type'),
    ('Active', 'Active', 'status'),
    ('Inactive', 'Inactive', 'status'),
    ('Lost', 'Lost', 'status')
  ON CONFLICT DO NOTHING;`,

  // Create detections table (if not exists)
  `CREATE TABLE IF NOT EXISTS detections (
    detection_id UUID DEFAULT uuid_generate_v4(),
    organization_id UUID,
    camera_id VARCHAR(255),
    tracking_id UUID,
    category_id UUID,
    detection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confidence DECIMAL(3,2),
    bounding_box JSONB,
    object_count INTEGER DEFAULT 1,
    video_filename VARCHAR(255),
    image_filename VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Insert sample detection data for testing
  `INSERT INTO detections (camera_id, detection_time, confidence, object_count, video_filename, image_filename) VALUES 
    ('CAM001', NOW() - INTERVAL '2 hours', 0.85, 3, 'video_001.mp4', 'image_001.jpg'),
    ('CAM001', NOW() - INTERVAL '1 hour 45 minutes', 0.92, 2, 'video_002.mp4', 'image_002.jpg'),
    ('CAM001', NOW() - INTERVAL '1 hour 30 minutes', 0.78, 1, 'video_003.mp4', 'image_003.jpg'),
    ('CAM002', NOW() - INTERVAL '3 hours', 0.88, 4, 'video_004.mp4', 'image_004.jpg'),
    ('CAM002', NOW() - INTERVAL '2 hours 30 minutes', 0.91, 2, 'video_005.mp4', 'image_005.jpg'),
    ('CAM003', NOW() - INTERVAL '4 hours', 0.82, 1, 'video_006.mp4', 'image_006.jpg'),
    ('CAM003', NOW() - INTERVAL '3 hours 15 minutes', 0.89, 3, 'video_007.mp4', 'image_007.jpg'),
    ('CAM003', NOW() - INTERVAL '2 hours 45 minutes', 0.76, 2, 'video_008.mp4', 'image_008.jpg')
  ON CONFLICT DO NOTHING;`,

  // Create object_status_history table
  `CREATE TABLE IF NOT EXISTS object_status_history (
    id SERIAL PRIMARY KEY,
    object_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255) NOT NULL
  );`,
];

async function initializeDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connected');

    console.log('📝 Running initialization queries...');
    
    for (let i = 0; i < initQueries.length; i++) {
      try {
        await client.query(initQueries[i]);
        console.log(`✅ Query ${i + 1} executed successfully`);
      } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`⚠️  Query ${i + 1}: Data already exists (skipping)`);
        } else {
          console.error(`❌ Query ${i + 1} failed:`, error.message);
        }
      }
    }

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const tables = ['users', 'camera_category_mapping', 'dropdown_options', 'detections'];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`, [table]);
        
        if (result.rows[0].exists) {
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.error(`❌ Table '${table}' missing`);
        }
      } catch (error) {
        console.error(`❌ Error checking table '${table}':`, error.message);
      }
    }

    client.release();
    console.log('\n🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check if PostgreSQL is running');
    console.log('2. Verify database credentials in .env file');
    console.log('3. Ensure database "yolo_db" exists');
    console.log('4. Check if user has proper permissions');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase().catch(console.error); 