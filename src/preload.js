'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onPayload: (cb) => ipcRenderer.on('payload', (_e, payload) => cb(payload)),
  request: () => ipcRenderer.send('request-payload'),
  refresh: () => ipcRenderer.send('refresh'),
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }),
  setLoginItem: (enabled) => ipcRenderer.send('set-login-item', enabled),
  resize: (height) => ipcRenderer.send('resize', height),
});
