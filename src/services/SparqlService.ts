import type { 
  SparqlResults 
} from '../models/types';
import { SparqlOperationType } from '../models/types';
import { 
  getSparqlUpdateEndpoint, 
  isValidEndpoint 
} from '../utils/sparql';

/**
 * Service for handling SPARQL requests
 */
export class SparqlService {
  private endpoint: string;
  private updateEndpoint: string;

  /**
   * Create a new SPARQL service
   * 
   * @param endpoint - SPARQL endpoint URL
   */
  constructor(endpoint: string) {
    this.endpoint = '';
    this.updateEndpoint = '';
    if (endpoint) {
      this.setEndpoint(endpoint);
    }
  }
  
  /**
   * Set the SPARQL endpoint URL
   * 
   * @param endpoint - Endpoint URL
   */
  setEndpoint(endpoint: string): void {
    if (!isValidEndpoint(endpoint)) {
      throw new Error('Invalid SPARQL endpoint URL');
    }
    
    this.endpoint = endpoint;
    this.updateEndpoint = getSparqlUpdateEndpoint(endpoint);
  }
  
  /**
   * Get the current endpoint URL
   * 
   * @returns SPARQL endpoint URL
   */
  getEndpoint(): string {
    return this.endpoint;
  }
  
  /**
   * Get the current update endpoint URL
   * 
   * @returns SPARQL update endpoint URL
   */
  getUpdateEndpoint(): string {
    return this.updateEndpoint;
  }
  
  /**
   * Execute a SPARQL query
   * 
   * @param query - SPARQL query
   * @returns Query results
   */
  async executeQuery(query: string): Promise<SparqlResults> {
    return await this.executeSparql(query, SparqlOperationType.QUERY);
  }
  
  /**
   * Execute a SPARQL update
   * 
   * @param query - SPARQL update query
   * @returns Response
   */
  async executeUpdate(query: string): Promise<Response> {
    return await this.executeSparql(query, SparqlOperationType.UPDATE);
  }
  
  /**
   * Execute a SPARQL operation
   * 
   * @param query - SPARQL query
   * @param type - Operation type (query or update)
   * @returns Query results or response
   */
  private async executeSparql(query: string, type: SparqlOperationType): Promise<any> {
    const endpoint = type === SparqlOperationType.QUERY ? this.endpoint : this.updateEndpoint;
    const param = type === SparqlOperationType.QUERY ? 'query' : 'update';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(type === SparqlOperationType.QUERY && {'Accept': 'application/sparql-results+json'})
      },
      body: `${param}=${encodeURIComponent(query)}`
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SPARQL ${type} failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    if (type === SparqlOperationType.QUERY) {
      return await response.json();
    }
    
    return response;
  }

  /**
   * Build an insert query for a new diagram point
   * 
   * @param pointIri - IRI of the new point
   * @param objectIri - IRI of the diagram object
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param sequenceNumber - Sequence number
   * @param cimNamespace - CIM namespace
   * @returns SPARQL insert query
   */
  buildInsertPointQuery(
    pointIri: string,
    objectIri: string,
    x: number,
    y: number,
    sequenceNumber: number,
    cimNamespace: string
  ): string {
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      INSERT DATA {
        <${pointIri}> rdf:type cim:DiagramObjectPoint .
        <${pointIri}> cim:DiagramObjectPoint.DiagramObject <${objectIri}> .
        <${pointIri}> cim:DiagramObjectPoint.xPosition "${x}"^^xsd:float .
        <${pointIri}> cim:DiagramObjectPoint.yPosition "${y}"^^xsd:float .
        <${pointIri}> cim:DiagramObjectPoint.sequenceNumber "${sequenceNumber}"^^xsd:integer .
      }
    `;
  }

  /**
   * Build an update query to update sequence numbers for points
   * 
   * @param points - Array of {iri, sequenceNumber} objects
   * @param cimNamespace - CIM namespace
   * @returns SPARQL update query
   */
  buildUpdateSequenceNumbersQuery(
    points: Array<{iri: string, sequenceNumber: number}>,
    cimNamespace: string
  ): string {
    let deleteClause = 'DELETE {';
    let insertClause = 'INSERT {';
    let whereClause = 'WHERE {';
    
    points.forEach((point, index) => {
      deleteClause += `
        <${point.iri}> cim:DiagramObjectPoint.sequenceNumber ?oldSeq${index} .`;
      
      insertClause += `
        <${point.iri}> cim:DiagramObjectPoint.sequenceNumber "${point.sequenceNumber}"^^xsd:integer .`;
      
      whereClause += `
        OPTIONAL { <${point.iri}> cim:DiagramObjectPoint.sequenceNumber ?oldSeq${index} . }`;
    });
    
    deleteClause += '\n}';
    insertClause += '\n}';
    whereClause += '\n}';
    
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      ${deleteClause}
      ${insertClause}
      ${whereClause}
    `;
  }

  /**
   * Insert a new point and update sequence numbers
   * 
   * @param newPoint - New point data
   * @param objectPoints - All points of the object with updated sequence numbers
   * @returns Success status
   */
  async insertNewPoint(
    newPoint: {
      iri: string,
      objectIri: string,
      x: number,
      y: number,
      sequenceNumber: number
    },
    objectPoints: Array<{iri: string, sequenceNumber: number}>,
    cimNamespace: string
  ): Promise<boolean> {
    try {
      // First insert the new point
      const insertQuery = this.buildInsertPointQuery(
        newPoint.iri,
        newPoint.objectIri,
        newPoint.x,
        newPoint.y,
        newPoint.sequenceNumber,
        cimNamespace
      );
      
      await this.executeUpdate(insertQuery);
      
      // Then update all sequence numbers
      const updateQuery = this.buildUpdateSequenceNumbersQuery(
        objectPoints,
        cimNamespace
      );
      
      await this.executeUpdate(updateQuery);
      
      return true;
    } catch (error) {
      console.error('Error inserting new point:', error);
      throw error;
    }
  }

  /**
   * Build a query to delete a point
   * 
   * @param pointIri - IRI of the point to delete
   * @param cimNamespace - CIM namespace
   * @returns SPARQL delete query
   */
  buildDeletePointQuery(
    pointIri: string,
    cimNamespace: string
  ): string {
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      DELETE {
        <${pointIri}> ?p ?o .
      }
      WHERE {
        <${pointIri}> ?p ?o .
      }
    `;
  }

  /**
   * Delete a point and update sequence numbers
   * 
   * @param pointIri - IRI of the point to delete
   * @param objectPoints - All remaining points of the object with updated sequence numbers
   * @param cimNamespace - CIM namespace
   * @returns Success status
   */
  async deletePoint(
    pointIri: string,
    objectPoints: Array<{iri: string, sequenceNumber: number}>,
    cimNamespace: string
  ): Promise<boolean> {
    try {
      // First delete the point
      const deleteQuery = this.buildDeletePointQuery(
        pointIri,
        cimNamespace
      );
      
      await this.executeUpdate(deleteQuery);
      
      // Then update all sequence numbers
      const updateQuery = this.buildUpdateSequenceNumbersQuery(
        objectPoints,
        cimNamespace
      );
      
      await this.executeUpdate(updateQuery);
      
      return true;
    } catch (error) {
      console.error('Error deleting point:', error);
      throw error;
    }
  }

  /**
   * Build a query to update the isPolygon property of a diagram object
   * 
   * @param objectIri - IRI of the diagram object
   * @param isPolygon - New value for the isPolygon property
   * @param cimNamespace - CIM namespace
   * @returns SPARQL update query
   */
  buildUpdatePolygonPropertyQuery(
    objectIri: string,
    isPolygon: boolean,
    cimNamespace: string
  ): string {
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      DELETE {
        <${objectIri}> cim:DiagramObject.isPolygon ?oldValue .
      }
      INSERT {
        <${objectIri}> cim:DiagramObject.isPolygon "${isPolygon}"^^xsd:boolean .
      }
      WHERE {
        OPTIONAL { <${objectIri}> cim:DiagramObject.isPolygon ?oldValue . }
      }
    `;
  }

  /**
   * Update the isPolygon property of a diagram object
   * 
   * @param objectIri - IRI of the diagram object
   * @param isPolygon - New value for the isPolygon property
   * @param cimNamespace - CIM namespace
   * @returns Success status
   */
  async updatePolygonProperty(
    objectIri: string,
    isPolygon: boolean,
    cimNamespace: string
  ): Promise<boolean> {
    try {
      const query = this.buildUpdatePolygonPropertyQuery(
        objectIri,
        isPolygon,
        cimNamespace
      );
      
      await this.executeUpdate(query);
      
      return true;
    } catch (error) {
      console.error('Error updating polygon property:', error);
      throw error;
    }
  }

  /**
   * Delete a point, update sequence numbers, and update polygon property in one transaction
   * 
   * @param pointIri - IRI of the point to delete
   * @param objectIri - IRI of the diagram object
   * @param isPolygon - New value for the isPolygon property
   * @param objectPoints - All remaining points of the object with updated sequence numbers
   * @param cimNamespace - CIM namespace
   * @returns Success status
   */
  async deletePointAndUpdatePolygon(
    pointIri: string,
    objectIri: string,
    isPolygon: boolean,
    objectPoints: Array<{iri: string, sequenceNumber: number}>,
    cimNamespace: string
  ): Promise<boolean> {
    try {
      // First delete the point
      const deleteQuery = this.buildDeletePointQuery(
        pointIri,
        cimNamespace
      );
      
      await this.executeUpdate(deleteQuery);
      
      // Then update the polygon property
      const updatePolygonQuery = this.buildUpdatePolygonPropertyQuery(
        objectIri,
        isPolygon,
        cimNamespace
      );
      
      await this.executeUpdate(updatePolygonQuery);
      
      // Finally update all sequence numbers
      const updateSequenceQuery = this.buildUpdateSequenceNumbersQuery(
        objectPoints,
        cimNamespace
      );
      
      await this.executeUpdate(updateSequenceQuery);
      
      return true;
    } catch (error) {
      console.error('Error deleting point and updating polygon:', error);
      throw error;
    }
  }
}



// Create singleton instance for use throughout the application
export const sparqlService = new SparqlService('');