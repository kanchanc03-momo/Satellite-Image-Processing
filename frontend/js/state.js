/**
 * EarthVision Global State & Persistence Manager
 */
(function(window) {
  const STORAGE_KEY_CAPTURES = 'earthvision_captures_v1';
  const STORAGE_KEY_HISTORY = 'earthvision_history_v1';
  const STORAGE_KEY_SETTINGS = 'earthvision_settings_v1';
  const STORAGE_KEY_CURRENT = 'earthvision_current_aoi_v1';
  const SESSION_KEY_ACTIVE_CAPTURE = 'earthvision_active_capture_v1';

  const defaultSettings = {
    aoiRadius: 1.0,
    units: 'metric',
    reducedMotion: false,
    density: 'comfortable',
    theme: 'dark'
  };

  const defaultAOI = {
    lat: 25.118,
    lon: 55.133,
    name: 'Dubai Coastal Archipelagos',
    radiusKm: 1.0,
    elevation: 3.0,
    source: 'Esri World Imagery',
    resolution: '0.5m - 1.0m / px (True Color RGB)'
  };

  class StateStore {
    constructor() {
      // Automatic cleanup: purge legacy oversized base64 dumps and old Dubai sample
      try {
        const rawCaptures = localStorage.getItem(STORAGE_KEY_CAPTURES);
        if (rawCaptures && (rawCaptures.includes('cap_sample_dubai') || rawCaptures.length > 50000)) {
          console.warn('Purging legacy localStorage captures to reclaim quota...');
          localStorage.removeItem(STORAGE_KEY_CAPTURES);
        }
        const rawHist = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (rawHist && rawHist.length > 50000) {
          console.warn('Purging bloated localStorage history to reclaim quota...');
          localStorage.removeItem(STORAGE_KEY_HISTORY);
        }
        // Also clear any legacy active capture holding Dubai
        const sessionActive = sessionStorage.getItem(SESSION_KEY_ACTIVE_CAPTURE);
        if (sessionActive && sessionActive.includes('cap_sample_dubai')) {
          sessionStorage.removeItem(SESSION_KEY_ACTIVE_CAPTURE);
        }
      } catch (_) {}

      this.listeners = [];
      this.currentAOI = this.loadJSON(STORAGE_KEY_CURRENT, defaultAOI);
      this.currentCapture = null;
      this.settings = this.loadJSON(STORAGE_KEY_SETTINGS, defaultSettings);
    }

    loadJSON(key, fallback) {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
      } catch (e) {
        console.warn(`Failed reading ${key} from storage:`, e);
        return fallback;
      }
    }

    saveJSON(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          console.warn(`Storage quota exceeded on ${key}, evicting older elements...`);
          if (Array.isArray(value) && value.length > 1) {
            // Keep reducing until it fits
            while (value.length > 2) {
              value.pop();
            }
            try {
              localStorage.setItem(key, JSON.stringify(value));
              return;
            } catch (_) {}
          }
          // If still fails, clear older captures
          try {
            localStorage.removeItem(STORAGE_KEY_CAPTURES);
            localStorage.setItem(key, JSON.stringify(value));
            return;
          } catch (_) {}
        }
        console.error(`Failed writing ${key} to storage:`, e);
      }
    }

    setAOI(aoiData) {
      this.currentAOI = { ...this.currentAOI, ...aoiData };
      this.saveJSON(STORAGE_KEY_CURRENT, this.currentAOI);
      this.notify('aoi', this.currentAOI);
    }

    getAOI() {
      return this.currentAOI;
    }

    saveCapture(captureRecord) {
      if (!captureRecord) return;
      this.currentCapture = captureRecord;

      // Always save active capture to sessionStorage for zero-quota-risk tab sharing
      try {
        sessionStorage.setItem(SESSION_KEY_ACTIVE_CAPTURE, JSON.stringify(captureRecord));
      } catch (e) {
        console.warn('sessionStorage active capture failed:', e);
      }

      const captures = this.getCaptures();
      // Prepend newest, filter out older duplicate IDs or same coords
      const filtered = captures.filter(c => c.id !== captureRecord.id && 
        !(Math.abs(c.lat - captureRecord.lat) < 0.001 && Math.abs(c.lon - captureRecord.lon) < 0.001));
      filtered.unshift(captureRecord);
      
      // Keep only 4 most recent captures to strictly respect localStorage 5MB limit
      while (filtered.length > 4) {
        filtered.pop();
      }
      this.saveJSON(STORAGE_KEY_CAPTURES, filtered);
      this.notify('capture', captureRecord);
    }

    getCaptures() {
      const stored = this.loadJSON(STORAGE_KEY_CAPTURES, []);
      const sessionActive = this.getActiveSessionCapture();
      if (sessionActive && (!stored.length || stored[0].id !== sessionActive.id)) {
        stored.unshift(sessionActive);
      }
      return stored;
    }

    getActiveSessionCapture() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY_ACTIVE_CAPTURE);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    getLatestCapture() {
      if (this.currentCapture) return this.currentCapture;
      const sessionActive = this.getActiveSessionCapture();
      if (sessionActive) return sessionActive;
      const list = this.getCaptures();
      return list && list.length > 0 ? list[0] : null;
    }

    deleteCapture(id) {
      const captures = this.getCaptures().filter(c => c.id !== id);
      this.saveJSON(STORAGE_KEY_CAPTURES, captures);
      this.notify('captures_updated', captures);
    }

    addHistoryItem(item) {
      const history = this.getHistory();
      // Guard: strip heavy base64 strings so history never exceeds quota
      const cleanItem = { ...item };
      if (cleanItem.thumbnail && cleanItem.thumbnail.length > 25000) {
        delete cleanItem.thumbnail;
      }
      history.unshift({
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        ...cleanItem
      });
      if (history.length > 20) history.pop();
      this.saveJSON(STORAGE_KEY_HISTORY, history);
      this.notify('history', history);
    }

    getHistory() {
      return this.loadJSON(STORAGE_KEY_HISTORY, []);
    }

    deleteHistoryItem(id) {
      const history = this.getHistory().filter(h => h.id !== id);
      this.saveJSON(STORAGE_KEY_HISTORY, history);
      this.notify('history', history);
    }

    clearHistory() {
      this.saveJSON(STORAGE_KEY_HISTORY, []);
      this.notify('history', []);
    }

    getSettings() {
      return this.settings;
    }

    updateSettings(newSettings) {
      this.settings = { ...this.settings, ...newSettings };
      this.saveJSON(STORAGE_KEY_SETTINGS, this.settings);
      this.notify('settings', this.settings);
    }

    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter(l => l !== fn);
      };
    }

    notify(type, data) {
      this.listeners.forEach(fn => {
        try { fn(type, data); } catch (e) { console.error(e); }
      });
    }

    notifyToast(message, type = 'info') {
      window.showToast?.(message, type);
    }
  }

  window.EarthVisionState = new StateStore();

  // Toast notification helper
  window.showToast = function(message, type = 'info', duration = 3500) {
    let container = document.getElementById('ev-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ev-toast-container';
      container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
      info: 'bg-[#151a23] border-[#4cd7f6]/40 text-[#dfe1f6]',
      success: 'bg-[#0f241a] border-[#4edea3]/50 text-[#6ffbbe]',
      error: 'bg-[#2a0e12] border-[#ffb4ab]/50 text-[#ffdad6]',
      warning: 'bg-[#291e0a] border-[#f59e0b]/50 text-[#fde68a]'
    };
    
    toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-xs font-medium shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-3 opacity-0 ${colors[type] || colors.info}`;
    
    const iconMap = {
      info: 'info',
      success: 'check_circle',
      error: 'error',
      warning: 'warning'
    };
    
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${iconMap[type] || 'info'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-3', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

})(window);
