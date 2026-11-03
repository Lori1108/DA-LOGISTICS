const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * API endpoint to ensure PREVENTA role and the two preventista users exist.
 * Trigger it with a POST request (e.g., via curl, fetch, or a button in the UI).
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const client = await pool.connect();
  try {
    // Ensure the enum value exists – run outside a transaction so it doesn't block on conflict
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_role') THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_role' AND e.enumlabel = 'PREVENTA'
          ) THEN
            ALTER TYPE enum_role ADD VALUE 'PREVENTA';
          END IF;
        END IF;
      END $$;
    `).catch(() => {});

    await client.query('BEGIN');

    // Generate bcrypt hash using pgcrypto (same as in the seed script)
    const { rows } = await client.query(
      "SELECT crypt($1, gen_salt('bf')) AS hash",
      ['Password123!']
    );
    const hash = rows[0].hash;

    const upsert = `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'PREVENTA')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;
    `;
    await client.query(upsert, ['preventista1@bilo.com', hash]);
    await client.query(upsert, ['preventista2@bilo.com', hash]);

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Preventista users created/updated' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error in create-preventa API', e);
    return res.status(500).json({ error: 'Failed to create users', details: e.message });
  } finally {
    client.release();
  }
};
