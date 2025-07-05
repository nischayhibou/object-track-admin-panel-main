import { Pool } from 'pg';
import config from '../config/config.json' with { type: 'json' };

const pool = new Pool(config.database);
export default pool;