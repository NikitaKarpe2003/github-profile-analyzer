// src/controllers/profileController.js
const { pool } = require('../config/database');
const {
  fetchUser,
  fetchRepos,
  computeLanguages,
  computeTopRepos,
  computeActivityScore,
} = require('../utils/githubService');

// POST /api/analyze/:username
const analyzeProfile = async (req, res, next) => {
  try {
    const { username } = req.params;

    const [user, repos] = await Promise.all([
      fetchUser(username),
      fetchRepos(username),
    ]);

    const totalStars = repos.reduce((a, r) => a + r.stargazers_count, 0);
    const totalForks = repos.reduce((a, r) => a + r.forks_count, 0);
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)
    );
    const avgStars = repos.length ? parseFloat((totalStars / repos.length).toFixed(2)) : 0;
    const activityScore = computeActivityScore(user, repos);
    const topLanguages = computeLanguages(repos);
    const topRepos = computeTopRepos(repos);

    const profileData = {
      username: user.login,
      name: user.name || null,
      bio: user.bio || null,
      avatar_url: user.avatar_url,
      profile_url: user.html_url,
      location: user.location || null,
      company: user.company || null,
      blog: user.blog || null,
      email: user.email || null,
      twitter_username: user.twitter_username || null,
      public_repos: user.public_repos,
      public_gists: user.public_gists,
      followers: user.followers,
      following: user.following,
      total_stars: totalStars,
      total_forks: totalForks,
      activity_score: activityScore,
      account_age_days: accountAgeDays,
      avg_stars_per_repo: avgStars,
      hireable: user.hireable ? 1 : 0,
      top_languages: JSON.stringify(topLanguages),
      top_repos: JSON.stringify(topRepos),
      github_created_at: new Date(user.created_at),
      github_updated_at: new Date(user.updated_at),
    };

    // Upsert profile
    const [existing] = await pool.execute(
      'SELECT id, analysis_count FROM github_profiles WHERE username = ?',
      [username]
    );

    let profileId;
    if (existing.length > 0) {
      profileId = existing[0].id;
      await pool.execute(
        `UPDATE github_profiles SET
          name=?, bio=?, avatar_url=?, location=?, company=?, blog=?, email=?,
          twitter_username=?, public_repos=?, public_gists=?, followers=?,
          following=?, total_stars=?, total_forks=?, activity_score=?,
          account_age_days=?, avg_stars_per_repo=?, hireable=?, top_languages=?,
          top_repos=?, github_updated_at=?, analysis_count=analysis_count+1
        WHERE username=?`,
        [
          profileData.name, profileData.bio, profileData.avatar_url,
          profileData.location, profileData.company, profileData.blog,
          profileData.email, profileData.twitter_username, profileData.public_repos,
          profileData.public_gists, profileData.followers, profileData.following,
          profileData.total_stars, profileData.total_forks, profileData.activity_score,
          profileData.account_age_days, profileData.avg_stars_per_repo,
          profileData.hireable, profileData.top_languages, profileData.top_repos,
          profileData.github_updated_at, username,
        ]
      );
    } else {
      const [result] = await pool.execute(
        `INSERT INTO github_profiles
          (username, name, bio, avatar_url, profile_url, location, company, blog,
           email, twitter_username, public_repos, public_gists, followers, following,
           total_stars, total_forks, activity_score, account_age_days, avg_stars_per_repo,
           hireable, top_languages, top_repos, github_created_at, github_updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          profileData.username, profileData.name, profileData.bio,
          profileData.avatar_url, profileData.profile_url, profileData.location,
          profileData.company, profileData.blog, profileData.email,
          profileData.twitter_username, profileData.public_repos, profileData.public_gists,
          profileData.followers, profileData.following, profileData.total_stars,
          profileData.total_forks, profileData.activity_score, profileData.account_age_days,
          profileData.avg_stars_per_repo, profileData.hireable,
          profileData.top_languages, profileData.top_repos,
          profileData.github_created_at, profileData.github_updated_at,
        ]
      );
      profileId = result.insertId;
    }

    // Save history snapshot
    await pool.execute(
      `INSERT INTO analysis_history (profile_id, username, followers, following, public_repos, total_stars, activity_score)
       VALUES (?,?,?,?,?,?,?)`,
      [profileId, username, user.followers, user.following, user.public_repos, totalStars, activityScore]
    );

    const [saved] = await pool.execute(
      'SELECT * FROM github_profiles WHERE id = ?', [profileId]
    );

    res.status(200).json({
      success: true,
      message: `Profile "${username}" analyzed and saved successfully`,
      data: formatProfile(saved[0]),
    });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, message: 'GitHub user not found' });
    }
    if (err.response?.status === 403) {
      return res.status(429).json({ success: false, message: 'GitHub API rate limit exceeded. Add GITHUB_TOKEN in .env' });
    }
    next(err);
  }
};

// GET /api/profiles
const getAllProfiles = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      sort = 'last_analyzed_at', order = 'DESC',
      search = '',
    } = req.query;

    const validSorts = ['followers', 'total_stars', 'activity_score', 'public_repos', 'last_analyzed_at'];
    const sortCol = validSorts.includes(sort) ? sort : 'last_analyzed_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const searchParam = `%${search}%`;

    const [rows] = await pool.execute(
      `SELECT * FROM github_profiles
       WHERE username LIKE ? OR name LIKE ?
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      [searchParam, searchParam]
    );

    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) as total FROM github_profiles WHERE username LIKE ? OR name LIKE ?',
      [searchParam, searchParam]
    );

    res.json({
      success: true,
      pagination: {
        total, page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
      data: rows.map(formatProfile),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/profiles/:username
const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM github_profiles WHERE username = ?', [username]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: `Profile "${username}" not found. Use POST /api/analyze/${username} first.`,
      });
    }

    const [history] = await pool.execute(
      'SELECT * FROM analysis_history WHERE profile_id = ? ORDER BY snapshot_at DESC LIMIT 10',
      [rows[0].id]
    );

    res.json({
      success: true,
      data: { ...formatProfile(rows[0]), history },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/profiles/:username
const deleteProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const [result] = await pool.execute(
      'DELETE FROM github_profiles WHERE username = ?', [username]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.json({ success: true, message: `Profile "${username}" deleted` });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats
const getStats = async (req, res, next) => {
  try {
    const [[counts]] = await pool.execute(
      `SELECT COUNT(*) as total_profiles,
              SUM(followers) as total_followers,
              AVG(activity_score) as avg_activity_score,
              MAX(followers) as max_followers,
              MAX(total_stars) as max_stars
       FROM github_profiles`
    );
    const [topProfiles] = await pool.execute(
      'SELECT username, followers, total_stars, activity_score, avatar_url FROM github_profiles ORDER BY activity_score DESC LIMIT 5'
    );
    res.json({ success: true, data: { summary: counts, top_profiles: topProfiles } });
  } catch (err) {
    next(err);
  }
};

// Helper: parse JSON fields before sending
const formatProfile = (row) => ({
  ...row,
  top_languages: typeof row.top_languages === 'string'
    ? JSON.parse(row.top_languages) : row.top_languages,
  top_repos: typeof row.top_repos === 'string'
    ? JSON.parse(row.top_repos) : row.top_repos,
  hireable: !!row.hireable,
});

module.exports = { analyzeProfile, getAllProfiles, getProfile, deleteProfile, getStats };