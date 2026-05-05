import '../config/loadEnv.js';
import { query } from '../db/index.js';

async function main() {
  // Ensure stores table exists (non-destructive).
  await query(`
    CREATE TABLE IF NOT EXISTS stores (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      store_code VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      email VARCHAR(255) DEFAULT NULL,
      gst_number VARCHAR(20) DEFAULT NULL,
      bank_name VARCHAR(100) DEFAULT NULL,
      bank_account_number VARCHAR(50) DEFAULT NULL,
      bank_ifsc_code VARCHAR(20) DEFAULT NULL,
      bank_branch_name VARCHAR(100) DEFAULT NULL,
      address_street VARCHAR(200) DEFAULT NULL,
      address_city VARCHAR(50) DEFAULT NULL,
      address_state VARCHAR(50) DEFAULT NULL,
      address_zip_code VARCHAR(10) DEFAULT NULL,
      address_country VARCHAR(50) DEFAULT 'India',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY store_code (store_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Seed the two stores from your backup.
  await query(`
    INSERT INTO stores (
      id, store_code, name, phone, email, gst_number, bank_name, bank_account_number, bank_ifsc_code, bank_branch_name,
      address_street, address_city, address_state, address_zip_code, address_country, is_active, created_by, created_at, updated_at
    ) VALUES
      (1, 'MS',  'Murugan Stores',       NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No.172/4B2C1, Vandavasi Road,', 'Sothupakkam,Melmaruvathur', NULL, '603319', 'India', 1, 1, '2025-11-19 12:02:12', '2026-04-24 09:05:22'),
      (2, 'MSM', 'Murugan Super Market', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No.172/4B2C1, Vandavasi Road,', 'Sothupakkam,Melmaruvathur', NULL, '603319', 'India', 1, 1, '2025-11-19 12:07:01', '2026-04-24 09:05:34')
    ON DUPLICATE KEY UPDATE
      store_code = VALUES(store_code),
      name = VALUES(name),
      address_street = VALUES(address_street),
      address_city = VALUES(address_city),
      address_zip_code = VALUES(address_zip_code),
      is_active = VALUES(is_active),
      updated_at = VALUES(updated_at)
  `);

  // Give admin user (id=2) access to all seeded stores.
  await query(`
    INSERT INTO user_stores (user_id, store_id, created_at, updated_at) VALUES
      (2, 1, NOW(), NOW()),
      (2, 2, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      updated_at = VALUES(updated_at)
  `);

  // Set a default store context for the admin.
  await query(`UPDATE users SET selected_store_id = 1 WHERE id = ?`, [2]);

  const stores = await query(`SELECT id, store_code, name FROM stores ORDER BY id`);
  const adminStores = await query(
    `
      SELECT s.id, s.store_code, s.name
      FROM stores s
      INNER JOIN user_stores us ON us.store_id = s.id
      WHERE us.user_id = ?
      ORDER BY s.id
    `,
    [2]
  );

  // eslint-disable-next-line no-console
  console.log('✅ Seeded stores:', stores);
  // eslint-disable-next-line no-console
  console.log('✅ Admin store access:', adminStores);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Failed seeding stores / access:', err?.message ?? err);
    process.exit(1);
  });

