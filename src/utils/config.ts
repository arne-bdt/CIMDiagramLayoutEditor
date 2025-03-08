import { CGMESVersion, DrawingPointConfig } from '../models/types';

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
      regularPoint: 'var(--point-regular-color)',
      selectedPoint: 'var(--point-selected-color)',
      singlePoint: 'var(--point-single-color)',
      line: 'var(--line-color)',
      selectionRectangle: 'var(--selection-rectangle-color)'
    },
    
    selectionThreshold: 6,
    zoomFactor: 1.1
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