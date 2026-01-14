import { createConnection } from 'mysql2/promise';
import bcryptjs from 'bcryptjs';

const connection = await createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'g_traffic_manager',
});

const adminUsername = 'admin123';
const adminPassword = 'TrafficG232569';
const saltRounds = 10;

const passwordHash = await bcryptjs.hash(adminPassword, saltRounds);

try {
  // Check if admin already exists
  const [rows] = await connection.execute(
    'SELECT id FROM users WHERE username = ?',
    [adminUsername]
  );

  if (rows.length > 0) {
    console.log('Admin user already exists');
  } else {
    // Create admin user
    await connection.execute(
      'INSERT INTO users (username, passwordHash, name, role) VALUES (?, ?, ?, ?)',
      [adminUsername, passwordHash, 'Administrator', 'admin']
    );
    console.log('Admin user created successfully');
  }
} catch (error) {
  console.error('Error seeding admin:', error);
}

await connection.end();
