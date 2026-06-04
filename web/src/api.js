const BASE = '/api';

export async function fetchMe() {
  const res = await fetch(`${BASE}/me`);
  return res.json();
}

export async function fetchModels(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') query.set(k, v);
  }
  const res = await fetch(`${BASE}/models?${query}`);
  return res.json();
}

export async function fetchModel(id) {
  const res = await fetch(`${BASE}/models/${id}`);
  return res.json();
}

export async function fetchCreators() {
  const res = await fetch(`${BASE}/creators`);
  return res.json();
}

export function previewUrl(id) {
  return `${BASE}/models/${id}/preview`;
}

export function creatorLogoUrl(folder) {
  return `${BASE}/creators/${encodeURIComponent(folder)}/logo`;
}

export function fileUrl(id, filename) {
  return `${BASE}/models/${id}/files/${encodeURIComponent(filename)}`;
}

export async function triggerReindex() {
  const res = await fetch(`${BASE}/reindex`, { method: 'POST' });
  return res.json();
}

export async function deleteModels(ids) {
  const res = await fetch(`${BASE}/models/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return res.json();
}

export async function fetchFavorites() {
  const res = await fetch(`${BASE}/favorites`);
  return res.json();
}

export async function setFavorite(id, on) {
  const res = await fetch(`${BASE}/favorites/${id}`, { method: on ? 'PUT' : 'DELETE' });
  return res.json();
}

export async function fetchCollections() {
  const res = await fetch(`${BASE}/collections`);
  return res.json();
}

export async function createCollection(name, hue) {
  const res = await fetch(`${BASE}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, hue }),
  });
  return res.json();
}

export async function setModelInCollection(collectionId, modelId, on) {
  const res = await fetch(`${BASE}/collections/${collectionId}/models/${modelId}`, {
    method: on ? 'PUT' : 'DELETE',
  });
  return res.json();
}

export async function fetchModelCollections(modelId) {
  const res = await fetch(`${BASE}/models/${modelId}/collections`);
  return res.json();
}

export async function fetchCounts() {
  const res = await fetch(`${BASE}/counts`);
  return res.json();
}

export async function fetchWeights() {
  const res = await fetch(`${BASE}/settings/weights`);
  return res.json();
}

export async function setWeight(creator, weight) {
  const res = await fetch(`${BASE}/settings/weights`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creator, weight }),
  });
  return res.json();
}
