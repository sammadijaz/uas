/**
 * UAS Desktop — Preload Script
 *
 * Exposes a safe, typed API to the renderer process via contextBridge.
 * The renderer cannot access Node.js APIs directly — only what's exposed here.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface UasApi {
  catalog: {
    search(query: string): Promise<any[]>;
    list(): Promise<any[]>;
    get(appId: string): Promise<any | null>;
    validate(appId: string): Promise<any>;
    filterByCategory(category: string): Promise<any[]>;
    filterByTag(tag: string): Promise<any[]>;
  };
  profile: {
    list(): Promise<string[]>;
    load(name: string): Promise<any | null>;
  };
  system: {
    info(): Promise<any>;
    paths(): Promise<any>;
  };
}

const api: UasApi = {
  catalog: {
    search: (query) => ipcRenderer.invoke('catalog:search', query),
    list: () => ipcRenderer.invoke('catalog:list'),
    get: (appId) => ipcRenderer.invoke('catalog:get', appId),
    validate: (appId) => ipcRenderer.invoke('catalog:validate', appId),
    filterByCategory: (category) => ipcRenderer.invoke('catalog:filter-category', category),
    filterByTag: (tag) => ipcRenderer.invoke('catalog:filter-tag', tag),
  },
  profile: {
    list: () => ipcRenderer.invoke('profile:list'),
    load: (name) => ipcRenderer.invoke('profile:load', name),
  },
  system: {
    info: () => ipcRenderer.invoke('system:info'),
    paths: () => ipcRenderer.invoke('system:paths'),
  },
};

contextBridge.exposeInMainWorld('uas', api);
