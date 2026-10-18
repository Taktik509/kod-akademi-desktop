// preload.js — pon solid ant main (Node) ak renderer (vanilla JS).
// Li fichye data/ yo ak fs (offline nèt) epi voye yo bay renderer
// atravè yon API ki san danje (contextBridge), pa gen nodeIntegration.
const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

function loadJson(file) {
  try {
    const full = path.join(__dirname, 'data', file);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    console.error('Kòd Akademi: pa ka li', file, err.message);
    return null;
  }
}

/** Chaje 16 modil langaj yo (data/modules/index.json + chak fichye). */
function loadModules() {
  const idx = loadJson('modules/index.json');
  if (!Array.isArray(idx)) return [];
  return idx
    .map(e => (e && e.file ? loadJson('modules/' + e.file) : null))
    .filter(Boolean);
}

const data = {
  lessons: loadJson('lessons.json') || [],
  exercises: loadJson('exercises.json') || [],
  ui: loadJson('ui.json') || { ht: {} },
  languages: loadJson('languages.json') || [],
  modules: loadModules(),
  guide: loadJson('guide/guide.json') || null,
  resources: loadJson('guide/resources.json') || null
};

contextBridge.exposeInMainWorld('kodapi', {
  getData: () => data,
  platform: process.platform
});
