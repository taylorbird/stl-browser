const BASE = '/api';

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
