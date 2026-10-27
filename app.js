const $ = (selector) => document.querySelector(selector);

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function showMessage(element, message, type = 'success') {
  element.textContent = message;
  element.className = `form-message ${type}`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

$('#registration-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#registration-message');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage(message, 'Submitting registration…');
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await api('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    showMessage(message, `${result.message} Please keep your registration reference: ${result.registrationId.slice(0, 8).toUpperCase()}`);
    form.reset();
  } catch (error) { showMessage(message, error.message, 'error'); }
  finally { button.disabled = false; }
});

$('#agenda-toggle').addEventListener('click', async () => {
  const panel = $('#agenda-list');
  const button = $('#agenda-toggle');
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !opening);
  button.setAttribute('aria-expanded', String(opening));
  if (!opening) return;
  panel.innerHTML = '<p>Loading agenda…</p>';
  try {
    const items = await api('/api/agenda');
    panel.innerHTML = items.map(item => `<article class="agenda-item"><small>${escapeHtml(item.day)} · ${escapeHtml(item.time)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || '')}</p></article>`).join('');
  } catch (error) { panel.textContent = error.message; }
});

$('#upload-toggle').addEventListener('click', () => $('#upload-form').classList.toggle('hidden'));
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#upload-message');
  const file = $('#file').files[0];
  if (!file) return showMessage(message, 'Choose a file first.', 'error');
  const data = new FormData();
  data.append('file', file);
  try {
    const result = await api('/api/upload', { method: 'POST', body: data });
    showMessage(message, result.message);
    form.reset();
    await loadDocuments();
  } catch (error) { showMessage(message, error.message, 'error'); }
});

async function loadDocuments() {
  const container = $('#document-list');
  try {
    const docs = await api('/api/documents');
    container.innerHTML = docs.length ? docs.map(doc => `<div class="document-row"><span>${escapeHtml(doc.originalName)}</span><a href="/api/documents/${encodeURIComponent(doc.id)}/download">Download</a></div>`).join('') : '<p class="muted">No documents have been uploaded yet.</p>';
  } catch (error) { container.textContent = error.message; }
}
$('#download-documents').addEventListener('click', async () => {
  await loadDocuments();
  $('#document-list').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
async function loadNews() {
  const container = $('#news-list');
  try {
    const news = await api('/api/news');
    container.innerHTML = news.map(item => `<div class="news-item"><time>${escapeHtml(item.date || '')}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>`).join('');
  } catch (error) { container.textContent = error.message; }
}
loadDocuments();
loadNews();

$('#notice-close').addEventListener('click', () => $('#notice-dialog').close());
