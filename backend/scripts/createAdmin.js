import '../config/loadEnv.js';
import bcrypt from 'bcryptjs';
import { query, hasUsersStoreIdColumn } from '../db/index.js';

const parsedSaltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
const BCRYPT_SALT_ROUNDS = Number.isFinite(parsedSaltRounds) && parsedSaltRounds > 0 ? parsedSaltRounds : 10;

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

async function main() {
  const emailRaw = process.argv[2];
  const password = process.argv[3];
  const firstName = process.argv[4] || 'Admin';

  if (!emailRaw || !password) {
    console.error('Usage: node scripts/createAdmin.js <email> <password> [firstName]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);

  if (existing.length > 0) {
    const id = existing[0].id;
    await query(
      `UPDATE users SET is_admin = 1, is_active = 1, password_hash = ?, updated_at = NOW() WHERE id = ?`,
      [passwordHash, id]
    );
    console.log(`Updated user ${email} (id=${id}): is_admin=1, password reset, is_active=1.`);
    return;
  }

  const insertColumns = [
    'first_name',
    'last_name',
    'email',
    'password_hash',
    'phone',
    'address_street',
    'address_city',
    'address_state',
    'address_zip_code',
    'address_country',
    'preferences',
    'screen_id',
    'is_admin',
    'is_active',
    'created_by',
    'selected_store_id',
  ];
  const insertValues = [
    firstName,
    null,
    email,
    passwordHash,
    null,
    null,
    null,
    null,
    null,
    'India',
    null,
    null,
    1,
    1,
    null,
    null,
  ];

  if (hasUsersStoreIdColumn) {
    insertColumns.push('store_id');
    insertValues.push(null);
  }

  insertColumns.push('created_at', 'updated_at');
  const placeholders = [...insertValues.map(() => '?'), 'NOW()', 'NOW()'];

  await query(
    `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    insertValues
  );
  console.log(`Created admin user ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
