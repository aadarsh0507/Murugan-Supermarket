import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import csvParser from 'csv-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from backend/
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CSV_FILE = process.argv[2];
if (!CSV_FILE) {
    console.error('Usage: node scripts/importSuppliersFromCsv.js <path-to-csv>');
    process.exit(1);
}

const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) {
    throw new Error('MYSQL_URL is not set in environment.');
}

// CSV header (lowercased) → actual DB column name
const CSV_TO_DB = {
    suppliercode: 'SUPPLIERCODE',
    name:         'NAME',
    store_id:     'store_id',
    address1:     'STREET',
    address2:     'ADDRESS1',
    address3:     'ADDRESS2',
    citycode:     'CITY',
    state:        'STATE',
    pincode:      'PINCODE',
    tngstnumber:  'TINNO',
    phone:        'PHONENO',
    isactive:     'isActive',
    mobilenumber: 'PHONENO',  // fallback if phone is empty
};

const NULL_VALUES = new Set(['null', 'NULL', '', 'undefined']);

function parseVal(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return NULL_VALUES.has(s) ? null : s;
}

function parsePhone(v) {
    const s = parseVal(v);
    if (s === null) return null;
    // Strip non-digit characters so landlines like "044-26690085" become "04426690085"
    const digits = s.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
}

async function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

async function main() {
    const rows = await readCsv(CSV_FILE);
    console.log(`Read ${rows.length} rows from CSV`);

    const conn = await mysql.createConnection({ uri: MYSQL_URL });

    // Get actual columns that exist in the Suppliers table
    const [cols] = await conn.query('DESCRIBE `Suppliers`');
    const existingCols = new Set(cols.map(c => c.Field.toUpperCase()));
    console.log('DB columns:', [...existingCols].join(', '));

    let inserted = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
        try {
            const dbRow = {};

            for (const [csvCol, rawVal] of Object.entries(row)) {
                const key = csvCol.trim().toLowerCase();
                const dbCol = CSV_TO_DB[key];
                if (!dbCol) continue;
                if (!existingCols.has(dbCol.toUpperCase())) continue;
                const val = dbCol === 'PHONENO' ? parsePhone(rawVal) : parseVal(rawVal);
                // Don't overwrite a non-null value with null for PHONENO
                if (dbRow[dbCol] != null && val == null) continue;
                dbRow[dbCol] = val;
            }

            if (!dbRow['NAME']) { skipped++; continue; }

            // SUPPLIERCODE from CSV
            const codeRaw = parseVal(row['Suppliercode'] ?? row['suppliercode']);
            if (codeRaw !== null) {
                const n = Number(codeRaw);
                if (Number.isInteger(n) && n > 0) dbRow['SUPPLIERCODE'] = n;
            }

            if (Object.keys(dbRow).length === 0) { skipped++; continue; }

            const fields = Object.keys(dbRow);
            const placeholders = fields.map(() => '?').join(', ');
            const backticked = fields.map(f => `\`${f}\``).join(', ');
            const values = fields.map(f => dbRow[f]);

            await conn.query(
                `INSERT INTO Suppliers (${backticked}) VALUES (${placeholders})
                 ON DUPLICATE KEY UPDATE NAME = VALUES(NAME), STREET = VALUES(STREET),
                 ADDRESS1 = VALUES(ADDRESS1), ADDRESS2 = VALUES(ADDRESS2),
                 CITY = VALUES(CITY), STATE = VALUES(STATE), PINCODE = VALUES(PINCODE),
                 PHONENO = VALUES(PHONENO), TINNO = VALUES(TINNO), isActive = VALUES(isActive),
                 store_id = VALUES(store_id)`,
                values
            );
            inserted++;
        } catch (err) {
            const label = row['Suppliercode'] ?? row['name'] ?? '?';
            errors.push({ row: label, error: err.message });
            skipped++;
        }
    }

    await conn.end();

    console.log(`\n✅ Done: ${inserted} inserted/updated, ${skipped} skipped`);
    if (errors.length) {
        console.log(`\n⚠️  First ${Math.min(errors.length, 10)} errors:`);
        errors.slice(0, 10).forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
    }
}

main().catch(err => {
    console.error('❌ Import failed:', err.message);
    process.exit(1);
});
