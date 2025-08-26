async function load() {
  try {
    const res = await fetch('./build/dataset.json');
    const data = await res.json();
    const info = document.getElementById('info');
    info.textContent = `dataset_version: ${data.dataset_version}, tracks: ${data.tracks.length}`;
  } catch (err) {
    console.error('Failed to load dataset', err);
  }
}

load();

