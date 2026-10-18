const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'Kòd Akademi',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Ouvri lyen ekstèn nan navigatè sistèm lan (pa nan app lan)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Fichye',
      submenu: [
        { role: 'reload', label: 'Rafrechi' },
        { type: 'separator' },
        { role: 'quit', label: 'Kite' }
      ]
    },
    {
      label: 'Fichye Edisyon',
      submenu: [
        { role: 'undo', label: 'Defè' },
        { role: 'redo', label: 'Refè' },
        { type: 'separator' },
        { role: 'cut', label: 'Koupe' },
        { role: 'copy', label: 'Kopye' },
        { role: 'paste', label: 'Kole' },
        { role: 'selectAll', label: 'Chwazi tout' }
      ]
    },
    {
      label: 'Ayèd',
      submenu: [
        {
          label: 'Konsènan Kòd Akademi',
          click: () => {
            const w = new BrowserWindow({
              width: 420,
              height: 300,
              title: 'Konsènan',
              resizable: false,
              webPreferences: { nodeIntegration: false }
            });
            w.loadURL(
              'data:text/html;charset=utf-8,' +
                encodeURIComponent(
                  '<body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:32px">' +
                    '<h2>Kòd Akademi v1.0.0</h2>' +
                    '<p>Aprann pwogramasyon an kreyòl, etap pa etap.<br>24 leson · 48 egzèsis · offline nèt.</p>' +
                    '<p>Medya 360 · Ayiti</p></body>'
                )
            );
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
