// src/utils/githubService.js
const axios = require('axios');

const headers = {
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
};

const token = process.env.GITHUB_TOKEN;
console.log('GitHub Token loaded:', token ? `YES (${token.slice(0,8)}...)` : 'NO - MISSING');

const githubAPI = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 10000,
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
  },
});
// Fetch basic user profile
const fetchUser = async (username) => {
  const { data } = await githubAPI.get(`/users/${username}`);
  return data;
};

// Fetch all public repos
const fetchRepos = async (username) => {
  const repos = [];
  let page = 1;
  while (true) {
    const { data } = await githubAPI.get(`/users/${username}/repos`, {
      params: { per_page: 100, page, sort: 'updated' },
    });
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return repos;
};

// Compute language breakdown from repos
const computeLanguages = (repos) => {
  const langCount = {};
  repos.forEach((r) => {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  });
  const total = Object.values(langCount).reduce((a, b) => a + b, 0);
  return Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([lang, count]) => ({
      language: lang,
      repo_count: count,
      percentage: parseFloat(((count / total) * 100).toFixed(2)),
    }));
};

// Get top repos by stars
const computeTopRepos = (repos) =>
  repos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      url: r.html_url,
    }));

// Custom activity score (0-100)
const computeActivityScore = (user, repos) => {
  const followers = Math.min(user.followers / 10, 25);
  const repoScore = Math.min(user.public_repos / 5, 20);
  const totalStars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  const starScore = Math.min(totalStars / 20, 30);
  const accountAgeYears =
    (Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24 * 365);
  const ageScore = Math.min(accountAgeYears * 5, 15);
  const gistScore = Math.min(user.public_gists / 5, 10);
  return parseFloat((followers + repoScore + starScore + ageScore + gistScore).toFixed(2));
};

module.exports = { fetchUser, fetchRepos, computeLanguages, computeTopRepos, computeActivityScore };