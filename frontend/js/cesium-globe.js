/**
 * EarthVision Cesium 3D Globe Controller
 * Photorealistic rendering, Esri World Imagery basemap, day/night lighting,
 * NASA GIBS night lights, free 360 camera controls, click-to-select, and AOI outline.
 */
(function(window) {
  class CesiumGlobeController {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.options = options;
      this.viewer = null;
      this.markerEntity = null;
      this.aoiEntity = null;
      this.pulseEntity = null;
      this.labelsLayer = null;
      this.nightLayer = null;
      this.isAutoRotating = options.autoRotate || false;
      this.currentAOIRadiusKm = options.defaultRadiusKm || 1.0;
      this.isMobile = window.innerWidth < 768;
      
      // Drag vs click detection
      this.mouseDownPos = null;
      this.dragThreshold = 6; // px
      this.pinIconUrl = createPinSvgDataUrl();
    }

    init() {
      if (!window.Cesium) {
        console.error("CesiumJS is not loaded on window.");
        return;
      }

      // No Cesium ion token required
      Cesium.Ion.defaultAccessToken = '';

      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error(`Container #${this.containerId} not found.`);
        return;
      }

      // Photorealistic True-Color Satellite Imagery (Esri World Imagery)
      const esriProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: 19,
        credit: 'Tiles © Esri'
      });

      // Reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        this.isAutoRotating = false;
      }

      this.viewer = new Cesium.Viewer(this.containerId, {
        imageryProvider: esriProvider,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        timeline: false,
        animation: false,
        fullscreenButton: false,
        selectionIndicator: false,
        requestRenderMode: false,
        contextOptions: {
          webgl: {
            alpha: true,
            preserveDrawingBuffer: true
          }
        }
      });

      const scene = this.viewer.scene;
      const globe = scene.globe;

      // Ensure space background behind Earth is black
      globe.baseColor = Cesium.Color.fromCssColorString('#090e1c');

      // Also attach ArcGisMapServerImageryProvider for high-fidelity tile levels
      Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', {
        enablePickFeatures: false
      }).then(arcGisProvider => {
        if (this.viewer && !this.viewer.isDestroyed()) {
          this.viewer.imageryLayers.removeAll();
          this.viewer.imageryLayers.addImageryProvider(arcGisProvider);
          if (this.nightLayer) {
            this.viewer.imageryLayers.add(this.nightLayer);
          }
        }
      }).catch(err => {
        console.warn("ArcGisMapServer fromUrl fallback to UrlTemplate:", err);
      });

      // Disable default Cesium entity selection indicator and popups
      if (this.viewer.selectionIndicator) {
        this.viewer.selectionIndicator.viewModel.selectionIndicatorElement.style.display = 'none';
      }
      this.viewer.selectedEntityChanged.addEventListener(() => {
        this.viewer.selectedEntity = undefined;
      });
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      // Disable thick ground atmosphere fog so the real Earth satellite imagery
      // (continents, oceans, deserts, green landscapes) is 100% visible and NOT washed out in blue!
      globe.showGroundAtmosphere = false;
      globe.enableLighting = false;

      // Subtle, photorealistic thin blue atmospheric rim at the edge of the planet only
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.atmosphereLightIntensity = 1.2;
      }

      // Starfield background
      if (scene.skyBox) {
        scene.skyBox.show = true;
      }

      // NASA GIBS Black Marble Night Lights on night side
      try {
        const nightLightsProvider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
          credit: 'NASA GIBS Night Lights'
        });
        this.nightLayer = this.viewer.imageryLayers.addImageryProvider(nightLightsProvider);
        this.nightLayer.dayAlpha = 0.0;
        this.nightLayer.nightAlpha = 0.85;
      } catch (e) {
        console.warn("NASA GIBS night lights layer unavailable", e);
      }

      // Labels layer (off by default, toggleable via layers control)
      try {
        const labelsProvider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          credit: 'Labels © Esri'
        });
        this.labelsLayer = this.viewer.imageryLayers.addImageryProvider(labelsProvider);
        this.labelsLayer.show = false;
      } catch (e) {}

      // Free 360 Controls configuration
      const controller = scene.screenSpaceCameraController;
      controller.enableRotate = true;
      controller.enableTranslate = true;
      controller.enableZoom = true;
      controller.enableTilt = true;
      controller.enableLook = true;
      controller.inertiaSpin = 0.88;
      controller.inertiaTranslate = 0.88;
      controller.inertiaZoom = 0.88;

      // Performance adjustment for mobile
      if (this.isMobile) {
        this.viewer.resolutionScale = 0.85;
      }

      // Initial Orbit View: Centered on Middle East with Earth rim visible
      const initialLat = this.options.initialLat || 25.118;
      const initialLon = this.options.initialLon || 55.133;
      const initialAltitude = this.options.initialAltitude || 15500000;

      this.viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(initialLon, initialLat, initialAltitude),
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_TWO,
          roll: 0.0
        }
      });

      // Setup Click vs Drag Handler
      this.setupInteractionHandlers();

      // Slow Auto-rotation if landing mode
      if (this.isAutoRotating) {
        this.startAutoRotation();
      }

      // Place initial selection marker & AOI if specified
      if (this.options.showInitialAOI) {
        this.updateSelection(initialLat, initialLon, this.currentAOIRadiusKm, false);
      }

      // Window resize handling
      window.addEventListener('resize', () => {
        this.viewer?.resize();
      });
    }

    setupInteractionHandlers() {
      // 1. Primary: Wire directly into Cesium Viewer's ScreenSpaceEventHandler
      const sseh = this.viewer.screenSpaceEventHandler;
      sseh.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      sseh.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      sseh.setInputAction((movement) => {
        this.stopAutoRotation();
        if (movement && movement.position) {
          this.handleLocationPick(movement.position);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      sseh.setInputAction((movement) => {
        this.stopAutoRotation();
        if (movement && movement.position) {
          this.handleLocationPick(movement.position);
        }
      }, Cesium.ScreenSpaceEventType.TAP);

      // 2. Secondary: Robust Pointer capture fallback to catch taps & clicks even if pointer moved slightly
      const canvas = this.viewer.canvas;
      let pointerDownState = null;

      canvas.addEventListener('pointerdown', (e) => {
        if (e.button === 0) {
          pointerDownState = { x: e.clientX, y: e.clientY, time: Date.now() };
          this.stopAutoRotation();
        }
      }, { passive: true, capture: true });

      window.addEventListener('pointerup', (e) => {
        if (!pointerDownState || e.button !== 0) return;
        const dx = e.clientX - pointerDownState.x;
        const dy = e.clientY - pointerDownState.y;
        const dt = Date.now() - pointerDownState.time;
        pointerDownState = null;

        // If moved <= 12px and completed within 700ms, it is a pin tap/click
        if (Math.hypot(dx, dy) <= 12 && dt < 700) {
          const rect = canvas.getBoundingClientRect();
          if (
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom
          ) {
            const pos = new Cesium.Cartesian2(e.clientX - rect.left, e.clientY - rect.top);
            this.handleLocationPick(pos);
          }
        }
      }, { capture: true });
    }

    handleLocationPick(screenPosition) {
      if (!screenPosition) return;
      const now = Date.now();
      if (this.lastPickTime && now - this.lastPickTime < 250) return;
      this.lastPickTime = now;

      const scene = this.viewer.scene;
      const c2 = (screenPosition instanceof Cesium.Cartesian2)
        ? screenPosition
        : new Cesium.Cartesian2(screenPosition.x, screenPosition.y);

      // Infallible multi-strategy raycast for Earth surface
      let cartesian = null;

      // Primary: camera.pickEllipsoid is exact, instantaneous, and works anywhere on the globe
      try {
        cartesian = scene.camera.pickEllipsoid(c2, scene.globe.ellipsoid);
      } catch (e) {
        console.warn("pickEllipsoid:", e);
      }

      // Secondary fallback: globe raycast
      if (!Cesium.defined(cartesian)) {
        try {
          const ray = scene.camera.getPickRay(c2);
          if (ray) {
            cartesian = scene.globe.pick(ray, scene);
          }
        } catch (_) {}
      }

      // Tertiary fallback: pickPosition
      if (!Cesium.defined(cartesian) && scene.pickPositionSupported) {
        try {
          cartesian = scene.pickPosition(c2);
        } catch (_) {}
      }

      if (!Cesium.defined(cartesian)) {
        console.log("[EarthVision] Click landed outside the Earth rim");
        return;
      }

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);

      if (isNaN(lat) || isNaN(lon)) return;

      console.log(`[EarthVision] Pinned location: Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`);

      // Trigger selection, outline, and fly-in
      this.selectLocation(lat, lon, this.currentAOIRadiusKm, true);
    }

    selectLocation(lat, lon, radiusKm = 1.0, animateFlyTo = true) {
      this.currentAOIRadiusKm = radiusKm;
      this.updateSelection(lat, lon, radiusKm, animateFlyTo);

      if (this.options.onSelect) {
        this.options.onSelect({
          lat: roundTo(lat, 5),
          lon: roundTo(lon, 5),
          radiusKm
        });
      }
    }

    updateSelection(lat, lon, radiusKm = 1.0, animateFlyTo = true) {
      this.currentAOIRadiusKm = radiusKm;
      const scene = this.viewer.scene;

      // Remove existing entities
      if (this.markerEntity) this.viewer.entities.remove(this.markerEntity);
      if (this.aoiEntity) this.viewer.entities.remove(this.aoiEntity);
      if (this.pulseEntity) this.viewer.entities.remove(this.pulseEntity);

      const center = Cesium.Cartesian3.fromDegrees(lon, lat);

      // High-visibility Map Pin Billboard + Reticle Center Point
      this.markerEntity = this.viewer.entities.add({
        position: center,
        billboard: {
          image: this.pinIconUrl,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          width: 36,
          height: 47,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        point: {
          pixelSize: 6,
          color: Cesium.Color.fromCssColorString('#4cd7f6'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      // Soft Pulse Ring (pulsing circle)
      this.pulseEntity = this.viewer.entities.add({
        position: center,
        ellipse: {
          semiMinorAxis: radiusKm * 1000 * 0.7,
          semiMajorAxis: radiusKm * 1000 * 0.7,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString('#4cd7f6').withAlpha(0.25)
          ),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#4cd7f6').withAlpha(0.7),
          outlineWidth: 1.5,
          height: 5
        }
      });

      // Square dashed AOI outline
      // Convert radiusKm to lat/lon degrees
      const dLat = radiusKm / 111.0;
      const dLon = radiusKm / (111.0 * Math.max(0.1, Math.cos(Cesium.Math.toRadians(lat))));

      const rect = Cesium.Rectangle.fromDegrees(
        lon - dLon, lat - dLat,
        lon + dLon, lat + dLat
      );

      this.aoiEntity = this.viewer.entities.add({
        rectangle: {
          coordinates: rect,
          material: Cesium.Color.fromCssColorString('#4cd7f6').withAlpha(0.12),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#4edea3').withAlpha(0.85),
          outlineWidth: 2
        }
      });

      if (animateFlyTo) {
        // Fly in ~2.5s ease-out to roughly 3 km altitude with nadir view
        const flyAltitude = Math.max(2500, radiusKm * 3200);
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, flyAltitude),
          orientation: {
            heading: 0.0,
            pitch: -Cesium.Math.PI_OVER_TWO,
            roll: 0.0
          },
          duration: 2.5,
          easingFunction: Cesium.EasingFunction.QUADRATIC_OUT
        });
      }
    }

    setAOIRadius(radiusKm) {
      this.currentAOIRadiusKm = radiusKm;
      const aoi = window.EarthVisionState?.getAOI();
      if (aoi && aoi.lat !== undefined && aoi.lon !== undefined) {
        this.updateSelection(aoi.lat, aoi.lon, radiusKm, false);
      }
    }

    startAutoRotation() {
      let lastTime = Date.now();
      this.autoRotateListener = () => {
        if (!this.isAutoRotating) return;
        const now = Date.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        // ~1 degree per 10 seconds
        this.viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.02 * dt);
      };
      this.viewer.scene.postRender.addEventListener(this.autoRotateListener);
    }

    stopAutoRotation() {
      if (this.isAutoRotating) {
        this.isAutoRotating = false;
        if (this.autoRotateListener) {
          this.viewer.scene.postRender.removeEventListener(this.autoRotateListener);
        }
      }
    }

    // Map Controls
    zoomIn() {
      this.viewer.camera.zoomIn(this.viewer.camera.positionCartographic.height * 0.35);
    }

    zoomOut() {
      this.viewer.camera.zoomOut(this.viewer.camera.positionCartographic.height * 0.45);
    }

    resetNorth() {
      const carto = this.viewer.camera.positionCartographic;
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
        orientation: {
          heading: 0.0,
          pitch: this.viewer.camera.pitch,
          roll: 0.0
        },
        duration: 1.0
      });
    }

    resetToOrbit() {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(55.133, 25.118, 15500000),
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_TWO,
          roll: 0.0
        },
        duration: 2.0
      });
    }

    toggleLabels() {
      if (this.labelsLayer) {
        this.labelsLayer.show = !this.labelsLayer.show;
        return this.labelsLayer.show;
      }
      return false;
    }

    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }

    computeVisibleViewBBox() {
      try {
        const rect = this.viewer.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid);
        if (rect) {
          const minLon = Cesium.Math.toDegrees(rect.west);
          const minLat = Cesium.Math.toDegrees(rect.south);
          const maxLon = Cesium.Math.toDegrees(rect.east);
          const maxLat = Cesium.Math.toDegrees(rect.north);
          return `${roundTo(minLon, 4)},${roundTo(minLat, 4)},${roundTo(maxLon, 4)},${roundTo(maxLat, 4)}`;
        }
      } catch (e) {
        console.warn("computeViewRectangle failed", e);
      }
      return null;
    }

    destroy() {
      this.stopAutoRotation();
      if (this.viewer && !this.viewer.isDestroyed()) {
        this.viewer.destroy();
      }
    }
  }

  function roundTo(val, dec = 4) {
    const factor = Math.pow(10, dec);
    return Math.round(val * factor) / factor;
  }

  function createPinSvgDataUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <defs>
        <filter id="pinShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/>
        </filter>
        <linearGradient id="pinBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4cd7f6"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
      </defs>
      <path d="M20 50 C20 50 4 30 4 19 A16 16 0 1 1 36 19 C36 30 20 50 20 50 Z" fill="url(#pinBody)" stroke="#ffffff" stroke-width="2.5" filter="url(#pinShadow)"/>
      <circle cx="20" cy="19" r="6" fill="#ffffff"/>
      <circle cx="20" cy="19" r="3" fill="#090e1c"/>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  window.CesiumGlobeController = CesiumGlobeController;

})(window);
