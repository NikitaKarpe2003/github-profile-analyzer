// src/config/schema.js
const { pool } = require('./database');

const initializeSchema = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS github_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(255),
      bio TEXT,
      avatar_url VARCHAR(500),
      profile_url VARCHAR(500),
      location VARCHAR(255),
      company VARCHAR(255),
      blog VARCHAR(500),
      email VARCHAR(255),
      twitter_username VARCHAR(100),
      public_repos INT DEFAULT 0,
      public_gists INT DEFAULT 0,
      followers INT DEFAULT 0,
      following INT DEFAULT 0,
      total_stars INT DEFAULT 0,
      total_forks INT DEFAULT 0,
      activity_score DECIMAL(5,2) DEFAULT 0,
      account_age_days INT DEFAULT 0,
      avg_stars_per_repo DECIMAL(8,2) DEFAULT 0,
      hireable BOOLEAN DEFAULT FALSE,
      top_languages JSON,
      top_repos JSON,
      github_created_at DATETIME,
      github_updated_at DATETIME,
      first_analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      analysis_count INT DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_id INT NOT NULL,
      username VARCHAR(100) NOT NULL,
      followers INT,
      following INT,
      public_repos INT,
      total_stars INT,
      activity_score DECIMAL(5,2),
      snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES github_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('✅ Database schema ready');
};

module.exports = { initializeSchema };