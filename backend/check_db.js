const mysql = require('mysql2/promise');

async function checkDb() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'medical_db'
  });
  
  const [rows] = await connection.execute('SELECT template_config FROM growth_curves ORDER BY created_at DESC LIMIT 1');
  console.log(JSON.stringify(rows[0].template_config, null, 2));
  await connection.end();
}
checkDb();
