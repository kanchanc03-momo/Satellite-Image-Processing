/**
 * EarthVision Relative API Client
 * Connects exclusively via relative /api paths with error handling and retry hints.
 */
(function(window) {
  const API_BASE = '/api';

  class ApiClient {
    async request(endpoint, options = {}) {
      const url = `${API_BASE}${endpoint}`;
      try {
        const resp = await fetch(url, options);
        if (!resp.ok) {
          let errDetail = `Server returned status ${resp.status}`;
          try {
            const errData = await resp.json();
            if (errData && errData.detail) {
              errDetail = errData.detail;
            }
          } catch (_) {}
          throw new Error(errDetail);
        }
        return resp;
      } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          window.showToast?.('Backend unreachable. Waking up the server or check local FastAPI...', 'warning', 5000);
          throw new Error('Connection failed: Backend service unreachable at /api.');
        }
        throw err;
      }
    }

    async reverseGeocode(lat, lon) {
      const resp = await this.request(`/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      return await resp.json();
    }

    async geocode(query) {
      const resp = await this.request(`/geocode?q=${encodeURIComponent(query)}`);
      return await resp.json();
    }

    async getElevation(lat, lon) {
      const resp = await this.request(`/elevation?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      return await resp.json();
    }

    async captureAOI(arg1, arg2, arg3, arg4) {
      let lat, lon, radiusKm = 1.0, bbox = null;
      if (typeof arg1 === 'object' && arg1 !== null) {
        lat = arg1.lat;
        lon = arg1.lon;
        radiusKm = arg1.radiusKm ?? arg1.radius_km ?? 1.0;
        bbox = arg1.bbox ?? null;
      } else {
        lat = arg1;
        lon = arg2;
        radiusKm = arg3 ?? 1.0;
        bbox = arg4 ?? null;
      }

      let query = '';
      if (bbox) {
        query = `?bbox=${encodeURIComponent(bbox)}`;
      } else {
        query = `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius_km=${encodeURIComponent(radiusKm)}`;
      }

      const resp = await this.request(`/capture${query}`);
      const metaHeader = resp.headers.get('X-Meta') || resp.headers.get('x-meta');
      let meta = {};
      if (metaHeader) {
        try {
          meta = JSON.parse(metaHeader);
        } catch (e) {
          console.warn('Failed parsing X-Meta header:', e);
        }
      }

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // Convert to base64 for persistent storage and DIP pipeline input
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      return {
        blob,
        objectUrl,
        dataUrl,
        meta
      };
    }

    async processImage(algo, image, params = {}) {
      const payload = {
        algo,
        image,
        params
      };

      const resp = await this.request('/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return await resp.json();
    }
  }

  window.EarthVisionAPI = new ApiClient();
})(window);
