const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'farmsync.db');
const db = new Database(DB_PATH);

const args = process.argv.slice(2);

function showSummary() {
    const tables = [
        'users',
        'fertilizer_stock',
        'workers',
        'equipment',
        'harvest_records',
        'transactions'
    ];

    console.log('--- Database Content Summary ---');
    tables.forEach(table => {
        try {
            const rows = db.prepare(`SELECT * FROM ${table} LIMIT 5`).all();
            console.log(`\nTable: ${table} (First 5 rows)`);
            console.table(rows);
        } catch (err) {
            console.error(`Error reading table ${table}:`, err.message);
        }
    });
    console.log('\nTip: Run "node view_db.js <table_name>" to see all records from a table.');
    console.log('Example: node view_db.js workers');
}

if (args.length === 0) {
    showSummary();
} else {
    const queryOrTable = args[0];
    try {
        let rows;
        if (queryOrTable.toLowerCase().startsWith('select')) {
            rows = db.prepare(queryOrTable).all();
            console.log(`\nResults for query: ${queryOrTable}`);
        } else {
            rows = db.prepare(`SELECT * FROM ${queryOrTable}`).all();
            console.log(`\nTable: ${queryOrTable} (All records)`);
        }
        console.table(rows);
    } catch (err) {
        console.error('Error:', err.message);
    }
}
