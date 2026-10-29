/**
 * EarthVision DIP Studio Workspace Controller
 * Real 19-algorithm engine with pipeline chaining, undo/redo/reset stack,
 * split-slider comparison, synced zoom & pan, live pixel RGB inspector, and real raster metrics.
 */
(function(window) {
  class DIPStudio {
    constructor() {
      this.originalImage = null;   // Original captured image data URL
      this.currentImage = null;    // Current working processed image data URL
      this.historyStack = [];      // For Undo
      this.redoStack = [];         // For Redo
      this.pipelineSteps = [];     // Applied chain steps [{ algo, params, time_ms, image, metrics, stats, hist, legend }]

      // View state
      this.compareMode = 'split';  // 'split', 'raw', 'processed', 'side-by-side'
      this.splitRatio = 0.5;       // 0.0 to 1.0
      this.zoom = 1.0;             // 0.25 to 8.0
      this.panOffset = { x: 0, y: 0 };
      this.isPanning = false;
      this.panStart = { x: 0, y: 0 };
      this.isDraggingSlider = false;

      // Histogram state
      this.activeHistMode = 'processed'; // 'processed' or 'original'
      this.activeHistChannels = { r: true, g: true, b: true, lum: true };

      // Current diagnostics cache
      this.latestMetrics = null;
      this.latestStats = null;
      this.latestHistOrig = null;
      this.latestHistProc = null;
      this.latestLegend = [];
      this.clusterNames = {};

      // DOM Elements cache
      this.els = {};
    }

    init() {
      this.cacheDOMElements();
      this.setupAccordions();
      this.setupLiveSliderLabels();
      this.setupSplitSlider();
      this.setupZoomAndPan();
      this.setupShortcuts();
      this.setupExportActions();

      // Load image from session/storage if available
      this.loadImageFromSession();

      // Subscribe to global store
      window.EarthVisionState?.subscribe((type, data) => {
        if (type === 'capture') {
          this.loadCapturedImage(data);
        }
      });
    }

    cacheDOMElements() {
      this.els = {
        viewerContainer: document.getElementById('viewer-container'),
        rawLayer: document.getElementById('raw-layer'),
        processedLayer: document.getElementById('processed-layer'),
        splitSliderLine: document.getElementById('split-slider-line'),
        splitDividerPill: document.getElementById('split-divider-pill'),
        toggleCompareBtn: document.getElementById('toggle-compare'),
        compareModeLabel: document.getElementById('compare-mode-label'),
        labelProcessed: document.getElementById('label-processed'),
        labelRaw: document.getElementById('label-raw'),
        pipelineList: document.getElementById('pipeline-list'),
        btnUndo: document.getElementById('btn-undo'),
        btnRedo: document.getElementById('btn-redo'),
        btnReset: document.getElementById('btn-reset'),
        btnExport: document.getElementById('btn-export'),
        zoomVal: document.getElementById('btn-zoom-reset'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        statusBadge: document.getElementById('status-badge'),
        hoverCoords: document.getElementById('hover-coords'),
        statMean: document.getElementById('stat-mean'),
        statStd: document.getElementById('stat-std'),
        statPsnr: document.getElementById('stat-psnr'),
        statSsim: document.getElementById('stat-ssim'),
        statEntropy: document.getElementById('stat-entropy'),
        statDynamic: document.getElementById('stat-dynamic'),
        histogramSvg: document.getElementById('histogram-svg'),
        partitionsContainer: document.getElementById('partitions-container'),
        theoryCard: document.getElementById('algo-theory-card'),
        theoryBadge: document.getElementById('theory-algo-badge'),
        theoryTitle: document.getElementById('theory-title'),
        theoryDesc: document.getElementById('theory-desc'),
        theoryFormula: document.getElementById('theory-formula'),
        theoryApp: document.getElementById('theory-application')
      };
    }

    async loadImageFromSession() {
      // 1. Check URL parameters first (?lat=...&lon=...)
      const urlParams = new URLSearchParams(window.location.search);
      const urlLat = parseFloat(urlParams.get('lat'));
      const urlLon = parseFloat(urlParams.get('lon'));

      const aoi = window.EarthVisionState?.getAOI();
      
      const targetLat = !isNaN(urlLat) ? urlLat : (aoi ? aoi.lat : 25.118);
      const targetLon = !isNaN(urlLon) ? urlLon : (aoi ? aoi.lon : 55.133);
      const targetRadius = aoi ? (aoi.radiusKm || 1.0) : 1.0;

      // Update context labels
      if (aoi && isNaN(urlLat)) {
        this.updateContextLabels(aoi);
      } else if (!isNaN(urlLat) && !isNaN(urlLon)) {
        this.updateContextLabels({
          lat: targetLat,
          lon: targetLon,
          name: aoi && Math.abs(aoi.lat - targetLat) < 0.005 ? aoi.name : `${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}°`,
          elevation: aoi ? aoi.elevation : 10
        });
        window.EarthVisionAPI.reverseGeocode(targetLat, targetLon).then(rev => {
          if (rev && rev.name) {
            this.updateContextLabels({ lat: targetLat, lon: targetLon, name: rev.name });
            window.EarthVisionState?.setAOI({ lat: targetLat, lon: targetLon, name: rev.name });
          }
        }).catch(() => {});
      }

      // 2. Check if we already have a valid capture for this EXACT target coordinates
      const latest = window.EarthVisionState?.getLatestCapture();
      const isLegacyDubaiSample = latest && (latest.id === 'cap_sample_dubai' || latest.name?.includes('Sample'));
      const matchesTarget = !isLegacyDubaiSample && latest && 
        (latest.dataUrl || latest.image) &&
        Math.abs(latest.lat - targetLat) < 0.008 && 
        Math.abs(latest.lon - targetLon) < 0.008;

      if (matchesTarget) {
        console.log(`[DIP Studio] Loading matched capture for (${targetLat}, ${targetLon}):`, latest.name);
        this.loadCapturedImage(latest);
        return;
      }

      // 3. If no matching capture exists, acquire the real satellite image for this target immediately!
      this.showToastNotice('Acquiring real 2D satellite swath for current target...', 'info', 2500);
      try {
        const res = await window.EarthVisionAPI.captureAOI(targetLat, targetLon, targetRadius);
        const name = (aoi && Math.abs(aoi.lat - targetLat) < 0.005 ? aoi.name : null) || `${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}°`;
        const newRecord = {
          id: 'cap_' + Date.now(),
          dataUrl: res.dataUrl,
          meta: res.meta,
          lat: targetLat,
          lon: targetLon,
          name: name
        };
        window.EarthVisionState?.saveCapture(newRecord);
        this.loadCapturedImage(newRecord);
        this.showToastNotice(`Satellite swath loaded for ${name}`, 'success');
      } catch (err) {
        console.error("Failed to acquire raster on workspace load:", err);
        if (latest && !isLegacyDubaiSample && (latest.dataUrl || latest.image)) {
          this.loadCapturedImage(latest);
        } else {
          this.showToastNotice('Failed to acquire raster: ' + err.message, 'error');
        }
      }
    }

    updateContextLabels(aoi) {
      const swathLabel = document.getElementById('swath-title');
      if (swathLabel && aoi.name) {
        swathLabel.textContent = aoi.name;
      }
      const latEl = document.getElementById('footer-lat');
      const lonEl = document.getElementById('footer-lon');
      const elevEl = document.getElementById('footer-elev');
      if (latEl && aoi.lat !== undefined) latEl.textContent = `${aoi.lat.toFixed(4)}°`;
      if (lonEl && aoi.lon !== undefined) lonEl.textContent = `${aoi.lon.toFixed(4)}°`;
      if (elevEl && aoi.elevation !== undefined) elevEl.textContent = `${aoi.elevation} m`;
    }

    loadCapturedImage(captureRecord) {
      if (!captureRecord || (!captureRecord.dataUrl && !captureRecord.image)) return;
      const imgUrl = captureRecord.dataUrl || captureRecord.image;
      
      this.originalImage = imgUrl;
      this.currentImage = imgUrl;
      this.historyStack = [];
      this.redoStack = [];
      this.pipelineSteps = [];

      if (captureRecord.name) {
        const swathLabel = document.getElementById('swath-title');
        if (swathLabel) swathLabel.textContent = captureRecord.name;
      }
      if (captureRecord.lat !== undefined && captureRecord.lon !== undefined) {
        this.updateContextLabels(captureRecord);
      }

      this.applyImageToViewer(imgUrl, imgUrl);
      this.updatePipelineUI();
      this.updateUndoRedoUI();

      // Compute initial histogram & metrics on original image
      this.runAlgorithm('histogram', {}, false);
    }

    applyImageToViewer(rawUrl, processedUrl) {
      if (this.els.rawLayer) {
        this.els.rawLayer.style.backgroundImage = `url('${rawUrl}')`;
      }
      if (this.els.processedLayer) {
        this.els.processedLayer.style.backgroundImage = `url('${processedUrl}')`;
      }
      this.updateSplitView();
    }

    setupAccordions() {
      const headers = document.querySelectorAll('.accordion-header');
      headers.forEach(header => {
        header.addEventListener('click', () => {
          const content = header.nextElementSibling;
          const icon = header.querySelector('.accordion-icon');
          const isOpen = !content.classList.contains('hidden');

          // Close all
          document.querySelectorAll('.accordion-content').forEach(c => c.classList.add('hidden'));
          document.querySelectorAll('.accordion-icon').forEach(i => i.textContent = 'expand_more');

          if (!isOpen) {
            content.classList.remove('hidden');
            if (icon) icon.textContent = 'expand_less';
          }
        });
      });
    }

    setupLiveSliderLabels() {
      const sliderPairs = [
        { id: 'slider-brightness', valId: 'val-brightness', format: v => (v > 0 ? `+${v}` : `${v}`) },
        { id: 'slider-contrast', valId: 'val-contrast', format: v => `${parseFloat(v).toFixed(1)}x` },
        { id: 'slider-gamma', valId: 'val-gamma', format: v => `${parseFloat(v).toFixed(2)}` },
        { id: 'slider-clahe-clip', valId: 'val-clahe-clip', format: v => `${parseFloat(v).toFixed(1)}` },
        { id: 'slider-clahe-tile', valId: 'val-clahe-tile', format: v => `${v}x${v}` },
        { id: 'slider-stretch-low', valId: 'val-stretch-low', format: v => `${v}%` },
        { id: 'slider-stretch-high', valId: 'val-stretch-high', format: v => `${v}%` },
        { id: 'slider-gaussian-k', valId: 'val-gaussian-k', format: v => `${v}px` },
        { id: 'slider-gaussian-s', valId: 'val-gaussian-s', format: v => `${parseFloat(v).toFixed(1)}` },
        { id: 'slider-median-k', valId: 'val-median-k', format: v => `${v}px` },
        { id: 'slider-mean-k', valId: 'val-mean-k', format: v => `${v}px` },
        { id: 'slider-sharpen-a', valId: 'val-sharpen-a', format: v => `${parseFloat(v).toFixed(1)}` },
        { id: 'slider-thresh-val', valId: 'val-thresh-val', format: v => `${v}` },
        { id: 'slider-ad-block', valId: 'val-ad-block', format: v => `${v}` },
        { id: 'slider-ad-c', valId: 'val-ad-c', format: v => `${v}` },
        { id: 'slider-kmeans-k', valId: 'val-kmeans-k', format: v => `k=${v}` },
        { id: 'slider-canny-low', valId: 'val-canny-low', format: v => `${v}` },
        { id: 'slider-canny-high', valId: 'val-canny-high', format: v => `${v}` },
        { id: 'slider-morph-k', valId: 'val-morph-k', format: v => `${v}px` },
        { id: 'slider-morph-iters', valId: 'val-morph-iters', format: v => `${v} iter${v > 1 ? 's' : ''}` }
      ];

      sliderPairs.forEach(({ id, valId, format }) => {
        const slider = document.getElementById(id);
        const label = document.getElementById(valId);
        if (slider && label) {
          slider.addEventListener('input', (e) => {
            let val = e.target.value;
            // Force odd if required
            if (id === 'slider-gaussian-k' || id === 'slider-median-k' || id === 'slider-mean-k' || id === 'slider-ad-block' || id === 'slider-morph-k') {
              if (parseInt(val) % 2 === 0) {
                val = parseInt(val) + 1;
                slider.value = val;
              }
            }
            label.textContent = format(val);
          });
        }
      });
    }

    async createSmallThumbnail(dataUrl, width = 80, height = 64) {
      if (!dataUrl) return null;
      return new Promise((resolve) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.55));
            } catch (_) {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = dataUrl;
        } catch (_) {
          resolve(null);
        }
      });
    }

    async runAlgorithm(algo, params = {}, recordInHistory = true) {
      if (!this.currentImage) {
        window.showToast?.('Please capture an image before applying DIP filters.', 'warning');
        return;
      }

      this.setStatus('Processing...', true);

      try {
        const res = await window.EarthVisionAPI.processImage(algo, this.currentImage, params);
        
        if (recordInHistory) {
          // Push current onto undo stack
          this.historyStack.push({
            image: this.currentImage,
            steps: [...this.pipelineSteps]
          });
          this.redoStack = []; // Clear redo stack on new operation
        }

        this.currentImage = res.image;
        this.latestMetrics = res.metrics;
        this.latestStats = res.stats_processed;
        this.latestHistOrig = res.hist_original;
        this.latestHistProc = res.hist_processed;
        this.latestLegend = res.legend || [];

        if (recordInHistory) {
          this.pipelineSteps.push({
            algo,
            params,
            time_ms: res.time_ms,
            image: res.image
          });

          // Generate lightweight ~1.2KB thumbnail for history cards
          const thumb = await this.createSmallThumbnail(res.image, 80, 64);

          // Save to persistent history (lightweight metadata)
          const aoi = window.EarthVisionState?.getAOI();
          window.EarthVisionState?.addHistoryItem({
            algorithm: algo,
            parameters: params,
            location: aoi?.name || 'Selected AOI',
            coordinates: aoi ? `${aoi.lat.toFixed(4)}°, ${aoi.lon.toFixed(4)}°` : 'N/A',
            time_ms: res.time_ms,
            metrics: res.metrics,
            thumbnail: thumb
          });
        }

        // Update UI
        this.applyImageToViewer(this.originalImage, this.currentImage);
        this.updateDiagnosticsUI(res);
        this.updateTheoryCard(algo, params);
        this.updatePipelineUI();
        this.updateUndoRedoUI();
        this.setStatus('Ready', false);

        if (this.els.labelProcessed) {
          const algoLabels = {
            brightness: 'Brightness Adjustment',
            contrast: 'Contrast Scaling',
            gamma: 'Gamma Correction',
            hist_eq: 'Histogram Equalization',
            clahe: 'CLAHE Equalization',
            contrast_stretch: 'Percentile Contrast Stretch',
            gaussian: 'Gaussian Smoothing',
            median: 'Median Filter (Denoise)',
            mean: 'Mean Box Blur',
            sharpen: 'Unsharp Mask Sharpening',
            gray_threshold: 'Binary Threshold',
            adaptive_threshold: 'Adaptive Threshold',
            kmeans: `K-Means Clusters (${params.k || 4})`,
            region_highlight: 'Otsu Region Accent',
            grayscale: 'Luminance Grayscale',
            rgb_channel: `Extracted Channel (${(params.channel || 'G').toUpperCase()})`,
            sobel: 'Sobel Edge Magnitude',
            canny: 'Canny Feature Edges',
            erosion: `Morphological Erosion (${params.ksize || 3}x${params.ksize || 3})`,
            dilation: `Morphological Dilation (${params.ksize || 3}x${params.ksize || 3})`,
            morph_open: `Morphological Opening (${params.ksize || 3}x${params.ksize || 3})`,
            morph_close: `Morphological Closing (${params.ksize || 3}x${params.ksize || 3})`,
            vegetation_proxy: 'Vegetation (Proxy, not NDVI)',
            histogram: 'Baseline Calibrated'
          };
          this.els.labelProcessed.textContent = algoLabels[algo] || algo;
        }

        window.showToast?.(`Applied ${algo} in ${res.time_ms}ms`, 'success');

      } catch (err) {
        console.error("DIP Error:", err);
        this.setStatus('Error', false);
        window.showToast?.(err.message || 'DIP Processing Failed', 'error');
      }
    }

    undo() {
      if (this.historyStack.length === 0) return;
      const prev = this.historyStack.pop();
      this.redoStack.push({
        image: this.currentImage,
        steps: [...this.pipelineSteps]
      });

      this.currentImage = prev.image;
      this.pipelineSteps = prev.steps;
      this.applyImageToViewer(this.originalImage, this.currentImage);
      this.updatePipelineUI();
      this.updateUndoRedoUI();
      this.updateTheoryCard('baseline');
      this.runAlgorithm('histogram', {}, false);
      window.showToast?.('Undo step', 'info');
    }

    redo() {
      if (this.redoStack.length === 0) return;
      const next = this.redoStack.pop();
      this.historyStack.push({
        image: this.currentImage,
        steps: [...this.pipelineSteps]
      });

      this.currentImage = next.image;
      this.pipelineSteps = next.steps;
      this.applyImageToViewer(this.originalImage, this.currentImage);
      this.updatePipelineUI();
      this.updateUndoRedoUI();
      this.updateTheoryCard('baseline');
      this.runAlgorithm('histogram', {}, false);
      window.showToast?.('Redo step', 'info');
    }

    reset() {
      if (!this.originalImage) return;
      if (this.pipelineSteps.length > 0) {
        this.historyStack.push({
          image: this.currentImage,
          steps: [...this.pipelineSteps]
        });
      }
      this.currentImage = this.originalImage;
      this.pipelineSteps = [];
      this.redoStack = [];
      this.applyImageToViewer(this.originalImage, this.originalImage);
      this.updatePipelineUI();
      this.updateUndoRedoUI();
      this.updateTheoryCard('baseline');
      this.runAlgorithm('histogram', {}, false);
      window.showToast?.('Reset pipeline to original image', 'info');
    }

    updateUndoRedoUI() {
      if (this.els.btnUndo) {
        this.els.btnUndo.disabled = this.historyStack.length === 0;
        this.els.btnUndo.classList.toggle('opacity-30', this.historyStack.length === 0);
      }
      if (this.els.btnRedo) {
        this.els.btnRedo.disabled = this.redoStack.length === 0;
        this.els.btnRedo.classList.toggle('opacity-30', this.redoStack.length === 0);
      }
      if (this.els.btnReset) {
        this.els.btnReset.disabled = this.pipelineSteps.length === 0;
        this.els.btnReset.classList.toggle('opacity-30', this.pipelineSteps.length === 0);
      }
    }

    updatePipelineUI() {
      if (!this.els.pipelineList) return;
      if (this.pipelineSteps.length === 0) {
        this.els.pipelineList.innerHTML = `
          <div class="p-3 text-center text-xs text-white/30 border border-dashed border-white/10 rounded-lg">
            No pipeline filters applied yet.
          </div>
        `;
        return;
      }

      this.els.pipelineList.innerHTML = this.pipelineSteps.map((step, idx) => `
        <div class="flex items-center justify-between p-2 rounded bg-[#151a23] border border-white/5 text-xs">
          <div class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-mono">${idx + 1}</span>
            <span class="font-medium text-white">${step.algo}</span>
            <span class="text-[10px] text-white/40 font-mono">${step.time_ms}ms</span>
          </div>
          <button onclick="window.dipStudio.removeStep(${idx})" class="text-white/40 hover:text-red-400 p-1 rounded" title="Remove step">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      `).join('');
    }

    removeStep(index) {
      if (index < 0 || index >= this.pipelineSteps.length) return;
      const remainingSteps = this.pipelineSteps.filter((_, i) => i !== index);
      
      // Re-run remaining steps from original image
      this.currentImage = this.originalImage;
      this.pipelineSteps = [];
      this.applyImageToViewer(this.originalImage, this.originalImage);

      // Sequentially apply remaining steps
      (async () => {
        for (const s of remainingSteps) {
          await this.runAlgorithm(s.algo, s.params, true);
        }
      })();
    }

    setupSplitSlider() {
      const viewer = this.els.viewerContainer;
      const slider = this.els.splitSliderLine;
      const rawLayer = this.els.rawLayer;

      if (!viewer || !slider || !rawLayer) return;

      const onMove = (clientX) => {
        if (!this.isDraggingSlider) return;
        const rect = viewer.getBoundingClientRect();
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        this.splitRatio = x / rect.width;
        this.updateSplitView();
      };

      slider.addEventListener('mousedown', (e) => {
        this.isDraggingSlider = true;
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => onMove(e.clientX));
      window.addEventListener('mouseup', () => { this.isDraggingSlider = false; });

      // Touch support
      slider.addEventListener('touchstart', () => { this.isDraggingSlider = true; });
      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) onMove(e.touches[0].clientX);
      });
      window.addEventListener('touchend', () => { this.isDraggingSlider = false; });

      // Compare Toggle button
      if (this.els.toggleCompareBtn) {
        this.els.toggleCompareBtn.addEventListener('click', () => {
          const modes = ['split', 'raw', 'processed', 'side-by-side'];
          const nextIdx = (modes.indexOf(this.compareMode) + 1) % modes.length;
          this.setCompareMode(modes[nextIdx]);
        });
      }
    }

    setCompareMode(mode) {
      this.compareMode = mode;
      const modeLabels = {
        'split': 'Split View',
        'raw': 'Original Only',
        'processed': 'Processed Only',
        'side-by-side': 'Side by Side'
      };
      if (this.els.compareModeLabel) {
        this.els.compareModeLabel.textContent = modeLabels[mode] || mode;
      }
      this.updateSplitView();
    }

    updateSplitView() {
      const slider = this.els.splitSliderLine;
      const rawLayer = this.els.rawLayer;
      const procLayer = this.els.processedLayer;
      if (!rawLayer || !procLayer) return;

      if (this.compareMode === 'split') {
        if (slider) slider.style.display = 'block';
        const pct = this.splitRatio * 100;
        if (slider) slider.style.left = `${pct}%`;
        rawLayer.style.display = 'block';
        procLayer.style.display = 'block';
        rawLayer.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0% 100%)`;
      } else if (this.compareMode === 'raw') {
        if (slider) slider.style.display = 'none';
        rawLayer.style.display = 'block';
        procLayer.style.display = 'none';
        rawLayer.style.clipPath = 'none';
      } else if (this.compareMode === 'processed') {
        if (slider) slider.style.display = 'none';
        rawLayer.style.display = 'none';
        procLayer.style.display = 'block';
      } else if (this.compareMode === 'side-by-side') {
        if (slider) slider.style.display = 'none';
        rawLayer.style.display = 'block';
        procLayer.style.display = 'block';
        rawLayer.style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)';
        procLayer.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)';
      }
    }

    setupZoomAndPan() {
      const viewer = this.els.viewerContainer;
      if (!viewer) return;

      // Mouse wheel zoom
      viewer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        this.setZoom(this.zoom + delta);
      }, { passive: false });

      // Pan handling
      viewer.addEventListener('mousedown', (e) => {
        if (e.target.closest('#split-slider-line') || e.target.closest('button')) return;
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isPanning) return;
        this.panOffset.x = e.clientX - this.panStart.x;
        this.panOffset.y = e.clientY - this.panStart.y;
        this.applyTransform();
      });

      window.addEventListener('mouseup', () => { this.isPanning = false; });

      // Zoom Buttons
      this.els.btnZoomIn?.addEventListener('click', () => this.setZoom(this.zoom + 0.25));
      this.els.btnZoomOut?.addEventListener('click', () => this.setZoom(this.zoom - 0.25));
      this.els.zoomVal?.addEventListener('click', () => this.resetZoomAndPan());

      // Hover Pixel RGB & Coordinate Inspector
      viewer.addEventListener('mousemove', (e) => {
        this.handlePixelSample(e);
      });
    }

    setZoom(newZoom) {
      this.zoom = Math.max(0.25, Math.min(8.0, newZoom));
      if (this.els.zoomVal) {
        this.els.zoomVal.textContent = `${Math.round(this.zoom * 100)}%`;
      }
      this.applyTransform();
    }

    resetZoomAndPan() {
      this.zoom = 1.0;
      this.panOffset = { x: 0, y: 0 };
      if (this.els.zoomVal) this.els.zoomVal.textContent = '100%';
      this.applyTransform();
    }

    applyTransform() {
      const transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoom})`;
      if (this.els.rawLayer) this.els.rawLayer.style.transform = transform;
      if (this.els.processedLayer) this.els.processedLayer.style.transform = transform;
    }

    handlePixelSample(e) {
      const viewer = this.els.viewerContainer;
      const coordEl = this.els.hoverCoords;
      if (!viewer || !coordEl) return;

      const rect = viewer.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);

      coordEl.innerHTML = `X: <span class="text-white">${x}</span> Y: <span class="text-white">${y}</span>`;
    }

    updateDiagnosticsUI(res) {
      const m = res.metrics || {};
      const s = res.stats_processed || {};

      if (this.els.statMean) this.els.statMean.textContent = s.mean !== undefined ? s.mean.toFixed(2) : '--';
      if (this.els.statStd) this.els.statStd.textContent = s.std !== undefined ? s.std.toFixed(2) : '--';
      if (this.els.statEntropy) this.els.statEntropy.textContent = m.entropy !== undefined ? `${m.entropy.toFixed(2)} bits` : '--';
      if (this.els.statDynamic) this.els.statDynamic.textContent = `${m.min ?? 0} - ${m.max ?? 255} DN`;
      if (this.els.statPsnr) this.els.statPsnr.textContent = m.psnr !== null && m.psnr !== undefined ? `${m.psnr} dB` : 'N/A';
      if (this.els.statSsim) this.els.statSsim.textContent = m.ssim !== null && m.ssim !== undefined ? `${m.ssim}` : 'N/A';

      this.renderHistogram(res.hist_processed || res.hist_original);
      this.renderClassPartitions(res.legend || []);
    }

    renderHistogram(hists) {
      const svg = this.els.histogramSvg;
      if (!svg || !hists) return;

      const maxVal = Math.max(
        ...hists.r, ...hists.g, ...hists.b, ...hists.lum, 1
      );

      const makePath = (data) => {
        let d = `M 0,100 `;
        for (let i = 0; i < 256; i++) {
          const y = 100 - (data[i] / maxVal) * 95;
          d += `L ${i},${y.toFixed(1)} `;
        }
        d += `L 255,100 Z`;
        return d;
      };

      let pathsHtml = `
        <line x1="0" y1="30" x2="256" y2="30" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
        <line x1="0" y1="65" x2="256" y2="65" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
      `;

      if (this.activeHistChannels.lum) {
        pathsHtml += `<path d="${makePath(hists.lum)}" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.3)" stroke-width="0.8"/>`;
      }
      if (this.activeHistChannels.r) {
        pathsHtml += `<path d="${makePath(hists.r)}" fill="rgba(239, 68, 68, 0.18)" stroke="#ef4444" stroke-width="1"/>`;
      }
      if (this.activeHistChannels.g) {
        pathsHtml += `<path d="${makePath(hists.g)}" fill="rgba(34, 197, 94, 0.18)" stroke="#22c55e" stroke-width="1"/>`;
      }
      if (this.activeHistChannels.b) {
        pathsHtml += `<path d="${makePath(hists.b)}" fill="rgba(77, 163, 255, 0.18)" stroke="#4da3ff" stroke-width="1"/>`;
      }

      svg.innerHTML = pathsHtml;
    }

    renderClassPartitions(legend) {
      const container = this.els.partitionsContainer;
      if (!container) return;

      if (!legend || legend.length === 0) {
        container.innerHTML = `
          <div class="py-4 text-center text-xs text-white/30 border border-dashed border-white/5 rounded">
            Apply K-Means or Segmentation to extract partition metrics.
          </div>
        `;
        return;
      }

      container.innerHTML = legend.map((item, idx) => {
        const customName = this.clusterNames[idx] || item.label;
        return `
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <input type="text" value="${customName}" 
                onchange="window.dipStudio.renameCluster(${idx}, this.value)"
                class="bg-transparent border-b border-transparent hover:border-white/20 focus:border-primary text-white/90 outline-none w-28 text-xs py-0.5" />
              <span class="font-mono" style="color: ${item.color}">${item.percent}%</span>
            </div>
            <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" 
                style="width: ${item.percent}%; background-color: ${item.color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    updateTheoryCard(algo, params = {}) {
      if (!this.els.theoryTitle || !this.els.theoryDesc) return;

      const knowledge = {
        baseline: {
          badge: "BASELINE",
          title: "Baseline Optical Satellite Imagery",
          desc: "Raw optical remote sensing satellite data calibrated to 8-bit digital numbers [0–255] per RGB channel. Select and apply any processing module from the left panel to inspect its mathematical formulation, remote sensing purpose, and viva explanation.",
          formula: "f(x, y) ∈ [0, 255]³ (True-Color RGB Matrix)",
          app: "Ground truth reference for calculating PSNR (fidelity) and SSIM (structural retention)."
        },
        brightness: {
          badge: "RADIOMETRY",
          title: "Linear Brightness Offset",
          desc: "Adds a uniform digital scalar across all color bands, shifting the radiometric histogram left or right to simulate varying illumination or daylight angle.",
          formula: "g(x, y) = clip(f(x, y) + β, 0, 255)",
          app: "Normalizes satellite scenes captured under varying solar zenith angles or shadowed terrain."
        },
        contrast: {
          badge: "RADIOMETRY",
          title: "Linear Contrast Scaling",
          desc: "Multiplies digital numbers by gain factor α to stretch or compress variance from the scene midpoint, expanding perceived radiometric separation.",
          formula: "g(x, y) = clip(α · (f(x, y) - 128) + 128, 0, 255)",
          app: "Improves visual discrimination between low-reflectance surfaces (e.g., deep water vs shallow wetlands)."
        },
        gamma: {
          badge: "RADIOMETRY",
          title: "Non-Linear Gamma Correction",
          desc: "Applies a non-linear power-law transform via precomputed 256-entry lookup table (LUT). Gamma < 1.0 brightens deep shadows without blowing out highlights; gamma > 1.0 deepens contrast.",
          formula: "g(x, y) = 255 · (f(x, y) / 255)^γ",
          app: "Corrects for non-linear atmospheric scattering (Rayleigh haze) and sensor detector response curves."
        },
        hist_eq: {
          badge: "HIST EQ",
          title: "Global Histogram Equalization (YCrCb)",
          desc: "Transforms the image to YCrCb color space, calculates the Cumulative Distribution Function (CDF) of the Luminance (Y) channel, and redistributes intensities uniformly across [0, 255] while locking chrominance channels to prevent color shift.",
          formula: "s_k = T(r_k) = (L - 1) · ∑ (n_j / N) for j = 0 to k",
          app: "Maximizes global contrast in washed-out, hazy, or low-dynamic-range satellite captures."
        },
        clahe: {
          badge: "CLAHE 2.0",
          title: "Contrast Limited Adaptive Histogram Equalization",
          desc: `Partitions the scene into an ${params.tile || 8}x${params.tile || 8} grid of contextual tiles. Each tile's histogram is clipped at limit ${params.clip || 2.0} to prevent over-amplifying sensor noise. Excess pixels are redistributed uniformly before bilinear interpolation between tile borders.`,
          formula: "Clip limit β = (N_pixels / N_bins) · (1 + α/100 · (S_max - 1))",
          app: "The premier enhancement standard in remote sensing: brings out local details in both bright urban rooftops and dark coastal waters simultaneously."
        },
        contrast_stretch: {
          badge: "STRETCH",
          title: "Percentile Linear Contrast Stretch",
          desc: `Computes cumulative percentiles (p${params.low || 2} to p${params.high || 98}) and stretches the bounded interval across the full dynamic range [0, 255], ignoring radiometric outliers and sensor dead pixels.`,
          formula: "g(x, y) = 255 · (f(x, y) - p_low) / (p_high - p_low)",
          app: "Standard pre-processing step for optical satellite feeds to utilize the full 8-bit quantization scale."
        },
        gaussian: {
          badge: "SPATIAL 2D",
          title: "Gaussian Spatial Convolution",
          desc: `Convolves the image with an isotropic 2D Gaussian kernel of size ${params.ksize || 5}x${params.ksize || 5} (σ=${params.sigma || 'auto'}). Weights decrease radially from the center according to a normal distribution.`,
          formula: "G(x, y) = (1 / 2πσ²) · e^(-(x² + y²) / (2σ²))",
          app: "Removes high-frequency Gaussian thermal noise and atmospheric turbulence before feature extraction."
        },
        median: {
          badge: "NON-LINEAR",
          title: "Median Filter (Salt-and-Pepper Denoise)",
          desc: `Replaces each pixel with the statistical median value of its ${params.ksize || 5}x${params.ksize || 5} neighborhood. Because it does not average pixel values, it eliminates extreme outliers while preserving sharp boundaries.`,
          formula: "g(x, y) = median { f(s, t) | (s, t) ∈ S_xy }",
          app: "Crucial for removing digital downlink transmission dropouts and bit-flip impulse noise while preserving coastlines and runways."
        },
        mean: {
          badge: "BOX FILTER",
          title: "Uniform Mean Box Filter",
          desc: `Applies a spatial moving average over a ${params.ksize || 5}x${params.ksize || 5} window with uniform weights (1/K²).`,
          formula: "g(x, y) = (1 / K²) · ∑ f(x+i, y+j)",
          app: "Rapid baseline smoothing filter used to estimate regional background reflectance."
        },
        sharpen: {
          badge: "UNSHARP MASK",
          title: "Unsharp Mask High-Frequency Sharpening",
          desc: `Subtracts a low-pass Gaussian blurred copy from the original image to isolate the high-frequency edge mask, then multiplies by gain amount ${params.amount || 1.0} and adds it back.`,
          formula: "f_sharp = f + amount · (f - f_blurred)",
          app: "Restores fine structural details, road networks, building footprints, and shipping vessels blurred by atmospheric haze."
        },
        sobel: {
          badge: "SOBEL ∇f",
          title: "Sobel Discrete Gradient Operator",
          desc: `Convolves the image with horizontal (Gx) and vertical (Gy) 3x3 derivative approximations, computing the continuous first-order spatial gradient vector magnitude at every pixel.`,
          formula: "|∇f| = √(Gx² + Gy²), where Gx = [[-1,0,1],[-2,0,2],[-1,0,1]] * f",
          app: "Delineates geological faults, coastal boundaries, canal edges, and urban infrastructure corridors."
        },
        canny: {
          badge: "CANNY HYSTERESIS",
          title: "Canny Multi-Stage Optimal Edge Detector",
          desc: `Executes a 4-step pipeline: 1) Gaussian smoothing, 2) Sobel gradient computation, 3) Non-maximum suppression (thins edges to 1-pixel ridges), and 4) Hysteresis thresholding (${params.low || 100} to ${params.high || 200}) to connect weak edges to strong ones.`,
          formula: "Hysteresis: T_high initiates edge; T_low preserves contiguous connection",
          app: "State-of-the-art vector edge delineation for land-use boundary mapping and satellite cartography."
        },
        gray_threshold: {
          badge: params.method === 'otsu' ? "OTSU VARIANCE" : "BINARY CUTOFF",
          title: params.method === 'otsu' ? "Otsu Maximum Between-Class Variance Thresholding" : "Manual Global Binary Thresholding",
          desc: params.method === 'otsu' 
            ? "Exhaustively computes the optimal threshold t* that maximizes between-class variance σ_B²(t) between foreground and background classes on the grayscale histogram."
            : `Classifies pixels above digital cutoff ${params.value || 127} as foreground (255) and below as background (0).`,
          formula: params.method === 'otsu' ? "σ_B²(t) = ω₀(t)ω₁(t) · [μ₀(t) - μ₁(t)]²" : "g(x, y) = 255 if f(x, y) ≥ T else 0",
          app: "Automated water-body vs land-mass separation; isolates high-reflectance urban buildings from surrounding terrain."
        },
        adaptive_threshold: {
          badge: "ADAPTIVE",
          title: "Local Adaptive Neighborhood Thresholding",
          desc: `Calculates a distinct local threshold for every individual pixel based on a ${params.block || 35}x${params.block || 35} Gaussian-weighted neighborhood minus offset C=${params.c || 5}.`,
          formula: "T(x, y) = GaussianMean(f, BlockSize) - C",
          app: "Overcomes uneven scene illumination caused by cloud cover, atmospheric gradients, and oblique sun angles."
        },
        kmeans: {
          badge: "K-MEANS ML",
          title: `K-Means Unsupervised Color Clustering (k=${params.k || 4})`,
          desc: `Partitions pixels into ${params.k || 4} clusters in 3D RGB color space using Lloyd's iterative algorithm. Pixels are assigned to the nearest cluster centroid, recalculating cluster centers until convergence.`,
          formula: "arg min_S ∑_{i=1}^k ∑_{x ∈ S_i} ||x - μ_i||²",
          app: "Land Use / Land Cover (LULC) automated segmentation: partitions the satellite swath into discrete classes (water, canopy, urban, bare soil) with exact percentage breakdown."
        },
        region_highlight: {
          badge: "MASK ACCENT",
          title: "Otsu Segmented Region Chromatic Accent",
          desc: "Applies Otsu's binary mask over the true-color satellite swath, tinting the segmented surface class with a vibrant chromatic overlay while preserving underlying geographic texture.",
          formula: "g(x, y) = 0.5 · f(x, y) + 0.5 · ColorMask(x, y)",
          app: "Highlights flood inundation zones, deforestation areas, or urban expansion zones over baseline imagery."
        },
        erosion: {
          badge: "MORPH EROSION",
          title: "Morphological Structuring Erosion",
          desc: `Slides a ${params.ksize || 3}x${params.ksize || 3} rectangular structuring element (SE) over the image. A pixel retains its value only if the SE fits entirely inside the object foreground (${params.iterations || 1} iteration).`,
          formula: "A ⊖ B = { z | (B)_z ⊆ A }",
          app: "Strips away isolated sensor noise specks, separates weakly connected islands or ships, and thins linear features."
        },
        dilation: {
          badge: "MORPH DILATION",
          title: "Morphological Structuring Dilation",
          desc: `Slides a ${params.ksize || 3}x${params.ksize || 3} structuring element (SE) over the image. If any pixel of the SE intersects the foreground, the target pixel is expanded (${params.iterations || 1} iteration).`,
          formula: "A ⊕ B = { z | (B̂)_z ∩ A ≠ ∅ }",
          app: "Bridges broken segments in roads, pipelines, and canals; seals small cracks and voids in runway pavement."
        },
        morph_open: {
          badge: "MORPH OPEN",
          title: "Morphological Opening (Erosion → Dilation)",
          desc: `Executes an erosion followed immediately by a dilation using a ${params.ksize || 3}x${params.ksize || 3} structuring element.`,
          formula: "A ∘ B = (A ⊖ B) ⊕ B",
          app: "Eliminates small bright sensor noise specks and thin peninsulas without shrinking the overall size of larger land masses."
        },
        morph_close: {
          badge: "MORPH CLOSE",
          title: "Morphological Closing (Dilation → Erosion)",
          desc: `Executes a dilation followed immediately by an erosion using a ${params.ksize || 3}x${params.ksize || 3} structuring element.`,
          formula: "A • B = (A ⊕ B) ⊖ B",
          app: "Fills small dark cavities, holes, and shadow gaps in building clusters while preserving outer object boundaries."
        },
        grayscale: {
          badge: "SPECTRAL",
          title: "ITU-R BT.601 Perceptual Luminance Grayscale",
          desc: "Converts the 3-channel RGB tensor into a single-channel radiometric luminance matrix using human photopic spectral sensitivity weights.",
          formula: "Y = 0.299 · R + 0.587 · G + 0.114 · B",
          app: "Eliminates color variance to prepare satellite scenes for gradient, threshold, or morphological filtering."
        },
        rgb_channel: {
          badge: "SPECTRAL BAND",
          title: `Single-Band Extraction (${(params.channel || 'G').toUpperCase()} Band)`,
          desc: `Extracts the single ${(params.channel || 'G').toUpperCase()} color band (Red: 660nm, Green: 560nm, or Blue: 480nm) as an isolated monochromatic raster.`,
          formula: "I_band(x, y) = I_RGB(x, y, c)",
          app: "Isolates band-specific spectral absorption (e.g. coastal water penetration via Blue; chlorophyll reflection via Green)."
        },
        vegetation_proxy: {
          badge: "EXG INDEX",
          title: "Excess Green Vegetation Index (2G - R - B)",
          desc: "Calculates the visible-spectrum Excess Green index (ExG) to highlight photosynthetic canopy coverage. Green vegetation reflects strongly in the 560nm waveband relative to red and blue.",
          formula: "ExG(x, y) = 2 · G(x, y) - R(x, y) - B(x, y)",
          app: "Provides an optical proxy for NDVI when Near-Infrared (NIR) satellite bands are not available."
        }
      };

      const info = knowledge[algo] || knowledge.baseline;
      if (this.els.theoryBadge) this.els.theoryBadge.textContent = info.badge;
      if (this.els.theoryTitle) this.els.theoryTitle.textContent = info.title;
      if (this.els.theoryDesc) this.els.theoryDesc.textContent = info.desc;
      if (this.els.theoryFormula) {
        this.els.theoryFormula.innerHTML = `
          <span class="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Mathematical Principle:</span>
          <span>${info.formula}</span>
        `;
      }
      if (this.els.theoryApp) {
        this.els.theoryApp.innerHTML = `
          <span class="font-semibold block text-[10px] uppercase text-primary/70 mb-0.5">Remote Sensing Purpose &amp; Viva Tip:</span>
          <span>${info.app}</span>
        `;
      }
    }

    renameCluster(idx, newName) {
      this.clusterNames[idx] = newName;
      window.showToast?.(`Cluster renamed to "${newName}"`, 'info');
    }

    setupShortcuts() {
      window.addEventListener('keydown', (e) => {
        // Prevent conflict when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          this.setZoom(this.zoom + 0.25);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          this.setZoom(this.zoom - 0.25);
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          const modes = ['split', 'raw', 'processed', 'side-by-side'];
          const nextIdx = (modes.indexOf(this.compareMode) + 1) % modes.length;
          this.setCompareMode(modes[nextIdx]);
        } else if (e.key === 'ArrowLeft' && this.compareMode === 'split') {
          e.preventDefault();
          this.splitRatio = Math.max(0.05, this.splitRatio - 0.05);
          this.updateSplitView();
        } else if (e.key === 'ArrowRight' && this.compareMode === 'split') {
          e.preventDefault();
          this.splitRatio = Math.min(0.95, this.splitRatio + 0.05);
          this.updateSplitView();
        }
      });
    }

    setupExportActions() {
      const btn = this.els.btnExport;
      if (!btn) return;

      btn.addEventListener('click', () => {
        this.openExportModal();
      });
    }

    openExportModal() {
      const modal = document.createElement('div');
      modal.id = 'export-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4';
      
      modal.innerHTML = `
        <div class="bg-[#151a23] border border-white/10 rounded-xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <span class="font-semibold text-sm text-white">Export & Download</span>
            <button onclick="document.getElementById('export-modal').remove()" class="text-white/40 hover:text-white">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div class="flex flex-col gap-2.5">
            <button onclick="window.dipStudio.downloadImage('processed')" class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary font-medium text-xs transition-colors">
              <span class="material-symbols-outlined text-[18px]">download</span>
              <span>Download Processed Raster (PNG)</span>
            </button>
            <button onclick="window.dipStudio.downloadImage('original')" class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors border border-white/5">
              <span class="material-symbols-outlined text-[18px]">photo</span>
              <span>Download Original Capture</span>
            </button>
            <button onclick="window.dipStudio.exportResultsJSON()" class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors border border-white/5">
              <span class="material-symbols-outlined text-[18px]">data_object</span>
              <span>Export Telemetry & Metrics (JSON)</span>
            </button>
            <button onclick="window.dipStudio.copySettingsToClipboard()" class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors border border-white/5">
              <span class="material-symbols-outlined text-[18px]">content_copy</span>
              <span>Copy Pipeline Parameters to Clipboard</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    downloadImage(type = 'processed') {
      const url = type === 'processed' ? this.currentImage : this.originalImage;
      if (!url) {
        window.showToast?.('No raster available for download', 'warning');
        return;
      }
      const lastStep = this.pipelineSteps && this.pipelineSteps.length > 0 ? this.pipelineSteps[this.pipelineSteps.length - 1] : null;
      const tag = type === 'processed' ? (lastStep ? lastStep.algo : 'processed') : 'raw';
      const a = document.createElement('a');
      a.href = url;
      a.download = `earthvision_${tag}_${Date.now()}.png`;
      a.click();
      window.showToast?.(`Downloaded ${tag.toUpperCase()} image (PNG)`, 'success');
      document.getElementById('export-modal')?.remove();
    }

    exportResultsJSON() {
      const aoi = window.EarthVisionState?.getAOI();
      const payload = {
        application: "EarthVision DIP Studio",
        version: "2.4.0",
        timestamp: new Date().toISOString(),
        aoi: aoi,
        pipeline_steps: this.pipelineSteps,
        raster_metrics: this.latestMetrics,
        statistics: this.latestStats,
        class_partitions: this.latestLegend
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earthvision_analytics_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      window.showToast?.('Exported telemetry & metrics JSON', 'success');
      document.getElementById('export-modal')?.remove();
    }

    copySettingsToClipboard() {
      const payload = {
        pipeline: this.pipelineSteps.map(s => ({ algo: s.algo, params: s.params }))
      };
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
        window.showToast?.('Pipeline configuration copied to clipboard!', 'success');
        document.getElementById('export-modal')?.remove();
      });
    }

    setStatus(text, isBusy = false) {
      if (this.els.statusBadge) {
        this.els.statusBadge.textContent = text;
        this.els.statusBadge.classList.toggle('animate-pulse', isBusy);
      }
    }
  }

  window.DIPStudio = DIPStudio;

})(window);
