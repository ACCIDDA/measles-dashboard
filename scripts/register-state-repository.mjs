#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  buildRegistryEntry,
  checkRegistryConflicts,
  isStateCode,
  parseRepositoryUrl,
  registryJson,
  validateEndpoint,
} from './registration-core.mjs';

const token = process.env.GITHUB_TOKEN;
const centralRepository = process.env.GITHUB_REPOSITORY;
const stateCode = (process.env.STATE_CODE || '').trim().toLowerCase();
const baseUrlInput = (process.env.BASE_URL || '').trim();
const repositoryInput = (process.env.REPOSITORY_URL || '').trim();

function fail(message) {
  console.error(`register-state-repository: ${message}`);
  process.exit(1);
}

if (!isStateCode(stateCode)) fail('state_code must be a recognized two-letter USPS code.');
if (!centralRepository?.includes('/')) fail('GITHUB_REPOSITORY is not set.');
if (!baseUrlInput && !repositoryInput) fail('at least one of base_url or repository_url is required.');

const source = (() => {
  if (!repositoryInput) return null;
  try {
    return parseRepositoryUrl(repositoryInput);
  } catch (error) {
    fail(error.message);
  }
})();
if (source && !token) fail('no GitHub token is available for repository provenance.');
const api = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    const detail = await response.text();
    const suffix = response.status === 404
      ? ' The repository may not exist, be inaccessible, or be private.'
      : ` (${response.status})`;
    throw new Error(`GitHub API request failed${suffix}: ${detail.slice(0, 300)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function main() {
  const centralRegistryPath = 'public/data/stateRegistry.json';
  const registry = JSON.parse(readFileSync(centralRegistryPath, 'utf8'));
  let repository = null;
  let sourceCommitSha = null;
  let baseUrl = baseUrlInput;
  if (source) {
    try {
      repository = await request(`/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`);
      if (repository.private && !baseUrl) {
        throw new Error('a public base_url is required when the source repository is private.');
      }
      const branch = await request(`/repos/${source.owner}/${source.repo}/branches/${encodeURIComponent(repository.default_branch)}`);
      sourceCommitSha = branch.commit.sha;
      if (!baseUrl) {
        baseUrl = `https://${source.owner}.github.io/${source.repo}/`;
      }
    } catch (error) {
      if (!baseUrl) throw error;
      console.warn(`register-state-repository: repository metadata unavailable; endpoint validation will continue: ${error.message}`);
    }
  }
  if (!baseUrl) fail('a public base_url is required when no repository endpoint can be derived.');
  const result = await validateEndpoint({ stateCode, baseUrl });
  const manifestPath = 'public/data/states.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  checkRegistryConflicts(registry, stateCode, repository?.id, source?.canonicalUrl);
  registry[stateCode] = buildRegistryEntry({
    stateCode,
    repositoryUrl: source?.canonicalUrl || null,
    repositoryId: repository?.id || null,
    datasetPath: 'data/',
    sourceCommitSha,
    stateName: result.stateName,
    reportingPeriod: result.reportingPeriod,
    baseUrl: result.baseUrl,
    dataHashes: result.dataHashes,
  });
  manifest[stateCode] = {
    ...(manifest[stateCode] || {}),
    fips: registry[stateCode].fips,
    name: result.stateName,
    status: 'ready',
  };
  process.stdout.write(JSON.stringify({
    repository,
    repository_url: source?.canonicalUrl || null,
    sourceCommitSha,
    result,
    registry: registryJson(registry),
    registryPath: centralRegistryPath,
    manifest: `${JSON.stringify(manifest, null, 2)}\n`,
    manifestPath,
    baseUrl: result.baseUrl,
  }));
}

main().catch((error) => fail(error.message));
