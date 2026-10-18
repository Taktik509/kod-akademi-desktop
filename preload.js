// preload.js — pon solid ant main (Node) ak renderer (vanilla JS).
// Li 4 fichye data/ yo ak fs (offline nèt) epi voye yo bay renderer
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

const data = {
  lessons: loadJson('lessons.json') || [],
  exercises: loadJson('exercises.json') || [],
  ui: loadJson('ui.json') || { ht: {} },
  languages: loadJson('languages.json') || []
};

contextBridge.exposeInMainWorld('kodapi', {
  getData: () => data,
  platform: process.platform
});
