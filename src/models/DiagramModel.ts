import { PointModel } from './PointModel';
import { Bounds, Point2D, SparqlResults } from './types';

/**
 * Model class for diagram objects
 */
export class DiagramObjectModel {
  iri: string;
  drawingOrder: number;
  isPolygon: boolean;
  isText: boolean;
  textContent: string;
  points: PointModel[];

  /**
   * Create a new diagram object
   * 
   * @param iri - Object IRI
   * @param drawingOrder - Drawing order
   * @param isPolygon - Whether object is a polygon
   * @param isText - Whether object is a text
   * @param textContent - Text content
   */
  constructor(
    iri: string, 
    drawingOrder: number,
    isPolygon: boolean,
    isText: boolean,
    textContent: string
  ) {
    this.iri = iri;
    this.drawingOrder = parseInt(String(drawingOrder)) || 0;
    this.isPolygon = isPolygon === true;
    this.isText = isText === true;
    this.textContent = textContent || '';
    this.points = [];
  }
  
  /**
   * Add a point to this object
   * 
   * @param point - Point to add
   */
  addPoint(point: PointModel): void {
    this.points.push(point);
    // Ensure points are sorted by sequence number
    this.points.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }
  
  /**
   * Check if this is a single point object
   * 
   * @returns True if this is a single point
   */
  isSinglePoint(): boolean {
    return this.points.length === 1;
  }
  
  /**
   * Get the bounds of this object
   * 
   * @returns Bounds object
   */
  getBounds(): Bounds {
    if (this.points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const point of this.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    return { minX, minY, maxX, maxY };
  }
  
  /**
   * Check if this object contains a specific point
   * 
   * @param pointIri - Point IRI to check
   * @returns True if object contains the point
   */
  containsPoint(pointIri: string): boolean {
    return this.points.some(point => point.iri === pointIri);
  }
  
  /**
   * Find a point near given coordinates
   * 
   * @param position - Position to check
   * @param radius - Search radius
   * @returns Found point or null
   */
  findPointNear(position: Point2D, radius: number): PointModel | null {
    const radiusSquared = radius * radius;
    
    for (const point of this.points) {
      if (point.distanceSquaredTo(position) <= radiusSquared) {
        return point;
      }
    }
    
    return null;
  }
  
  /**
   * Create a DiagramObjectModel from raw data
   * 
   * @param binding - Raw object data
   * @returns New diagram object model
   */
  static fromSparqlBinding(binding: any): DiagramObjectModel {
    return new DiagramObjectModel(
      binding.diagramObject.value,
      binding.drawingOrder?.value ?? 0,
      binding.isPolygon?.value === 'true',
      binding.isTextDiagramObject?.value === 'true',
      binding.textContent?.value ?? ''
    );
  }
}

/**
 * Model for the complete diagram data
 */
export class DiagramModel {
  objects: DiagramObjectModel[];
  points: PointModel[];
  texts: DiagramObjectModel[];

  /**
   * Create a new diagram model
   */
  constructor() {
    this.objects = [];
    this.points = [];
    this.texts = [];
  }
  
  /**
   * Add a diagram object
   * 
   * @param object - Object to add
   */
  addObject(object: DiagramObjectModel): void {
    this.objects.push(object);
    
    // Add to texts array if it's a text object
    if (object.isText && object.textContent) {
      this.texts.push(object);
    }
  }
  
  /**
   * Add a point
   * 
   * @param point - Point to add
   */
  addPoint(point: PointModel): void {
    this.points.push(point);
  }
  
  /**
   * Sort objects by drawing order
   */
  sortObjects(): void {
    this.objects.sort((a, b) => a.drawingOrder - b.drawingOrder);
  }
  
  /**
   * Get all diagram bounds
   * 
   * @returns Bounds with minX, minY, maxX, maxY
   */
  getBounds(): Bounds {
    if (this.points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const point of this.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    return { minX, minY, maxX, maxY };
  }
  
  /**
   * Find a point near given coordinates
   * 
   * @param position - Position to check
   * @param radius - Search radius
   * @returns Found point or null
   */
  findPointNear(position: Point2D, radius: number): PointModel | null {
    const radiusSquared = radius * radius;
    let closestPoint: PointModel | null = null;
    let closestDistSq = radiusSquared;
    
    for (const point of this.points) {
      const distSq = point.distanceSquaredTo(position);
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestPoint = point;
      }
    }
    
    return closestPoint;
  }
  
  /**
   * Process diagram data from SPARQL response
   * 
   * @param data - SPARQL response data
   * @returns Processed diagram model
   */
  static fromSparqlResults(results: SparqlResults): DiagramModel {
    const diagram = new DiagramModel();
    const objectMap = new Map<string, DiagramObjectModel>();
    
    // First pass: create objects
    results.results.bindings.forEach(binding => {
      const objectIri = binding.diagramObject.value;
      
      if (!objectMap.has(objectIri)) {
        const object = DiagramObjectModel.fromSparqlBinding(binding);
        
        objectMap.set(objectIri, object);
        diagram.addObject(object);
      }
    });
    
    // Second pass: add points to objects
    results.results.bindings.forEach(binding => {
      const objectIri = binding.diagramObject.value;
      const pointIri = binding.point.value;
      const object = objectMap.get(objectIri);
      
      if (object) {
        const point = PointModel.fromSparqlBinding(binding, object);
        
        object.addPoint(point);
        diagram.addPoint(point);
      }
    });
    
    // Sort objects by drawing order
    diagram.sortObjects();
    
    return diagram;
  }
}