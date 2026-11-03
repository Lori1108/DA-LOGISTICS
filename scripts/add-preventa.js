const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // Try to add enum value if enum_role exists – do this outside of a transaction
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

    // Begin transaction for user upserts
    await client.query('BEGIN');

    // Create bcrypt hash using pgcrypto
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
    console.log('✅ Preventista users created/updated');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error inserting users', e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
