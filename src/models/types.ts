/**
 * CGMES namespace versions
 */
export enum CGMESVersion {
  V2_4_15 = '2.4.15',
  V3_0 = '3.0'
}

/**
 * View transform properties for canvas
 */
export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Point position in 2D
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Point movement delta
 */
export interface PointDelta {
  dx: number;
  dy: number;
}

/**
 * Rectangle bounds
 */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Canvas size
 */
export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Canvas drawing point properties
 */
export interface DrawingPointConfig {
  base: number;
  min: number;
  max: number;
}

/**
 * Mouse interaction modes
 */
export enum InteractionMode {
  NONE = 'none',
  PANNING = 'panning',
  SELECTING = 'selecting',
  DRAGGING = 'dragging'
}

/**
 * Interaction state
 */
export interface InteractionState {
  mode: InteractionMode;
  dragStart: Point2D | null;
  dragEnd: Point2D | null;
  panStart: Point2D | null;
  selectedPoints: Set<string>;
  originalPositions: Map<string, Point2D>;
}

/**
 * SPARQL query/update types
 */
export enum SparqlOperationType {
  QUERY = 'query',
  UPDATE = 'update'
}

/**
 * SPARQL result binding format
 */
export interface SparqlBinding {
  [key: string]: {
    type: string;
    value: string;
    datatype: string
  };
}

/**
 * SPARQL query results
 */
export interface SparqlResults {
  head: {
    vars: string[];
  };
  results: {
    bindings: SparqlBinding[];
  };
}

/**
 * Diagram data from SPARQL
 */
export interface SparqlDiagramData {
  iri: string;
  name: string;
}

/**
 * Point data structure for update
 */
export interface PointUpdateData {
  points: string[];
  dx: number;
  dy: number;
}

// Export all types as a namespace to avoid circular dependencies
export default {
  CGMESVersion,
  InteractionMode,
  SparqlOperationType
};