import { CGMESVersion, type DrawingPointConfig } from '../models/types';

/**
 * Application configuration settings
 */
export const AppConfig = {
  // Canvas display settings
  canvas: {
    pointSize: {
      base: 3,
      min: 1,
      max: 5
    } as DrawingPointConfig,
    
    fontSize: {
      base: 12,
      min: 8,
      max: 14
    } as DrawingPointConfig,
    
    colors: {
      regularPoint: 'green',      // Points in paths/polygons
      selectedPoint: 'red',       // Selected points
      singlePoint: 'blue',        // Single points not in paths
      line: 'black',              // Lines connecting points
      selectionRectangle: 'blue', // Selection rectangle
      grid: 'rgba(200, 200, 200, 0.5)' // Light gray grid lines
    },
    
    selectionThreshold: 6,
    zoomFactor: 1.1
  },

  // Grid settings
  grid: {
    enabled: false,     // Grid visibility by default
    size: 10,           // Grid cell size in world coordinates
    snapEnabled: false, // Snap-to-grid by default
    snapThreshold: 10   // Distance in pixels for snapping
  },
  
  // CIM namespaces for different CGMES versions
  namespaces: {
    [CGMESVersion.V2_4_15]: 'http://iec.ch/TC57/2013/CIM-schema-cim16#',
    [CGMESVersion.V3_0]: 'http://iec.ch/TC57/CIM100#'
  },
  
  // Default diagram view settings
  view: {
    initialScale: 1,
    initialOffsetX: 0,
    initialOffsetY: 0,
    padding: 0.05 // 5% padding around auto-fitted diagrams
  },
  
  // Drag threshold in world coordinates - below this is considered a click
  dragThreshold: 0.1,
  
  // Default endpoint
  defaultEndpoint: 'http://localhost:3030/SmallGrid_DL'
};