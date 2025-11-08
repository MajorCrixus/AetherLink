# Cesium Migration Plan

## Goal
Replace Three.js globe with full CesiumJS implementation to enable:
- Street-level zoom with terrain
- Multiple imagery providers (Bing, Mapbox, Sentinel, etc.)
- 2D/3D/Columbus view modes
- Geocoding and fly-to locations
- Native time-dynamic visualization
- Satellite tracking (CZML, TLE propagation)
- Digital Arsenal integration

## Phase 1: Setup & Basic Globe ✅ COMPLETE
- [x] Document migration plan
- [x] Install cesium npm package (v1.134.1) via Resium
- [x] Configure Vite for Cesium (vite-plugin-static-copy)
- [x] Create CesiumGlobe component with basic viewer
- [x] Render basic globe with default imagery
- [x] Test that it works alongside existing widgets
- [x] Build with increased memory (NODE_OPTIONS=4096MB)

## Phase 2: Core Features
- [ ] Integrate TimeControl with Cesium clock
- [ ] Add imagery provider switcher (Bing, OSM, Sentinel, etc.)
- [ ] Implement 2D/3D/Columbus view switching
- [ ] Add camera position controls
- [ ] Implement antenna marker as Cesium entity

## Phase 3: Advanced Visualization
- [ ] Add geocoding/search functionality (Nominatim or similar)
- [ ] Enable terrain/elevation data
- [ ] Configure sun/lighting for realistic day/night
- [ ] Add atmosphere, fog, and other effects
- [ ] Implement satellite tracking (prep for Digital Arsenal)

## Phase 4: UI & Polish
- [ ] Integrate Cesium's native widgets (timeline, animation)
- [ ] Create custom control panel matching AetherLink design
- [ ] Add keyboard shortcuts (Cesium conventions)
- [ ] Performance optimization
- [ ] Mobile touch controls

## Phase 5: Digital Arsenal Integration
- [ ] Research Digital Arsenal APIs
- [ ] Implement satellite database integration
- [ ] Add CZML entity streaming
- [ ] Implement TLE propagation
- [ ] Add satellite tracking UI

## Current Status
**Started:** 2025-11-02
**Phase:** 1 - COMPLETE ✅ | Ready for Phase 2 - Core Features
**Last Updated:** 2025-11-02
**Build Status:** ✅ Successful (6MB bundle, 1.65MB gzipped)
**Runtime Status:** ✅ Webapp running on http://localhost:3001
**Backend Status:** ✅ Fixed and running (venv recreated at /home/major/aetherlink/venv)
**Module Issues:** ✅ Fixed with vite-plugin-cesium

## Key Files
- `/webapp/frontend/src/components/dashboard/CesiumGlobe.tsx` - New Cesium component
- `/webapp/frontend/src/components/dashboard/GlobalView.tsx` - DEPRECATED, will be replaced
- `/webapp/frontend/vite.config.ts` - Needs Cesium-specific config
- `/webapp/frontend/package.json` - Cesium dependency

## Notes
- Cesium adds ~1.65MB gzipped to bundle (6MB uncompressed)
- **IMPORTANT:** Build requires 4GB Node heap: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
- **IMPORTANT:** Use `vite-plugin-cesium` instead of manual configuration (fixes mersenne-twister and other module issues)
- vite-plugin-cesium handles static asset copying, base URL, and module resolution automatically
- Digital Arsenal uses Cesium 1.95+ (currently using 1.134.1 - compatible)
- Resium v1.21.1 provides React wrapper for Cesium
- Access viewer via `viewerRef.current?.cesiumElement` (not direct Viewer ref)

## Imagery Configuration

**Current Setup**: Using **Cesium Ion** with full access token configured

**Enabled Features:**
- ✅ Bing Maps aerial/satellite imagery (high-resolution)
- ✅ Sentinel-2 satellite imagery
- ✅ World Terrain with 3D elevation
- ✅ Multiple imagery provider options via Base Layer Picker
- ✅ Ion asset streaming
- ✅ Nominatim geocoding (location search)

**Ion Token**: Configured in `CesiumGlobe.tsx` line 38

## References
- Cesium Docs: https://cesium.com/learn/cesiumjs/
- Digital Arsenal: https://digitalarsenal.io/
- Cesium Sandcastle: https://sandcastle.cesium.com/
