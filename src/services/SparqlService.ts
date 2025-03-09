import type { 
  SparqlResults 
} from '../models/types';
import { SparqlOperationType } from '../models/types';
import { 
  getSparqlUpdateEndpoint, 
  isValidEndpoint 
} from '../utils/sparql';
import { v4 as uuidv4 } from 'uuid';

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

 /**
   * Clone objects with their points and apply an offset to the point positions
   * 
   * @param diagramIri - Diagram IRI
   * @param objectIris - IRIs of objects to clone
   * @param offsetX - X offset to apply to point positions
   * @param offsetY - Y offset to apply to point positions
   * @param cimNamespace - CIM namespace
   * @returns New object and point IRIs
   */
  async cloneObjectsWithOffset(
    diagramIri: string,
    objectIris: string[],
    offsetX: number,
    offsetY: number,
    cimNamespace: string
  ): Promise<{ objectIris: string[], pointIris: string[] }> {
    try {
      // Step 1: Create mappings for new IRIs
      const objectMapping = new Map<string, string>();
      const gluePointMapping = new Map<string, string>();
      const newPointIris: string[] = [];
      
      // Create new IRIs for each DiagramObject
      objectIris.forEach(iri => {
        const newIri = `http://tempuri.org/diagramObject/${uuidv4()}`;
        objectMapping.set(iri, newIri);
      });
      
      // Step 2: Clone all DiagramObjects (including TextDiagramObjects)
      let objectCloneQuery = `
        PREFIX cim: <${cimNamespace}>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        INSERT {
          ?newObj ?p ?o .
          ?newObj cim:DiagramObject.Diagram <${diagramIri}> .
        }
        WHERE {
          VALUES (?obj ?newObj) {
            ${Array.from(objectMapping.entries()).map(([oldIri, newIri]) => `(<${oldIri}> <${newIri}>)`).join('\n          ')}
          }
          ?obj ?p ?o .
          FILTER(?p != cim:DiagramObject.Diagram)
        }
      `;
      
      await this.executeUpdate(objectCloneQuery);
      
      // Step 3: Find all DiagramGluePoints linked to the DiagramObjects via DiagramObjectPoints
      const gluePointsQuery = `
        PREFIX cim: <${cimNamespace}>
        
        SELECT DISTINCT ?gluePoint
        WHERE {
          VALUES ?obj {
            ${objectIris.map(iri => `<${iri}>`).join('\n          ')}
          }
          ?point cim:DiagramObjectPoint.DiagramObject ?obj .
          ?point cim:DiagramObjectPoint.DiagramObjectGluePoint ?gluePoint .
        }
      `;
      
      const gluePointsResult = await this.executeQuery(gluePointsQuery);
      
      // Step 4: Create new IRIs for GluePoints and build mapping
      if (gluePointsResult.results && gluePointsResult.results.bindings) {
        gluePointsResult.results.bindings.forEach(binding => {
          if (binding.gluePoint) {
            const oldGlueIri = binding.gluePoint.value;
            const newGlueIri = `http://tempuri.org/gluePoint/${uuidv4()}`;
            gluePointMapping.set(oldGlueIri, newGlueIri);
          }
        });
      }
      
      // Step 5: Clone the DiagramGluePoints if any were found
      if (gluePointMapping.size > 0) {
        const gluePointCloneQuery = `
          PREFIX cim: <${cimNamespace}>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          
          INSERT {
            ?newGlue ?p ?o .
          }
          WHERE {
            VALUES (?glue ?newGlue) {
              ${Array.from(gluePointMapping.entries()).map(([oldIri, newIri]) => `(<${oldIri}> <${newIri}>)`).join('\n            ')}
            }
            ?glue ?p ?o .
          }
        `;
        
        await this.executeUpdate(gluePointCloneQuery);
      }
      
      // Step 6: Clone the DiagramObjectPoints with adjusted positions
      const pointsQuery = `
        PREFIX cim: <${cimNamespace}>
        
        SELECT ?point ?obj ?gluePoint ?x ?y
        WHERE {
          VALUES ?obj {
            ${objectIris.map(iri => `<${iri}>`).join('\n          ')}
          }
          ?point cim:DiagramObjectPoint.DiagramObject ?obj .
          ?point cim:DiagramObjectPoint.xPosition ?x .
          ?point cim:DiagramObjectPoint.yPosition ?y .
          OPTIONAL { ?point cim:DiagramObjectPoint.DiagramObjectGluePoint ?gluePoint . }
        }
      `;
      
      const pointsResult = await this.executeQuery(pointsQuery);
      
      if (pointsResult.results && pointsResult.results.bindings && pointsResult.results.bindings.length > 0) {
        // Prepare insert query for points
        let pointCloneQuery = `
          PREFIX cim: <${cimNamespace}>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
          
          INSERT {
        `;
        
        // Process each point
        pointsResult.results.bindings.forEach(binding => {
          if (binding.point) {
            //const oldPointIri = binding.point.value;
            const newPointIri = `http://tempuri.org/point/${uuidv4()}`;
            newPointIris.push(newPointIri);
            
            pointCloneQuery += `
              <${newPointIri}> ?p ?o .
            `;
            
            // Add special triples with new references
            if (binding.obj && objectMapping.has(binding.obj.value)) {
              pointCloneQuery += `
                <${newPointIri}> cim:DiagramObjectPoint.DiagramObject <${objectMapping.get(binding.obj.value)}> .
              `;
            }
            
            if (binding.gluePoint && gluePointMapping.has(binding.gluePoint.value)) {
              pointCloneQuery += `
                <${newPointIri}> cim:DiagramObjectPoint.DiagramObjectGluePoint <${gluePointMapping.get(binding.gluePoint.value)}> .
              `;
            }
            
            // Add adjusted position
            if (binding.x && binding.y) {
              const newX = parseFloat(binding.x.value) + offsetX;
              const newY = parseFloat(binding.y.value) + offsetY;
              
              pointCloneQuery += `
                <${newPointIri}> cim:DiagramObjectPoint.xPosition "${newX}"^^xsd:float .
                <${newPointIri}> cim:DiagramObjectPoint.yPosition "${newY}"^^xsd:float .
              `;
            }
          }
        });
        
        // Complete the first part of the query
        pointCloneQuery += `
          }
          WHERE {
        `;
        
        // For each point, get all its properties except the ones we've specially handled
        pointsResult.results.bindings.forEach((binding, index) => {
          if (binding.point) {
            const oldPointIri = binding.point.value;
            const newPointIri = newPointIris[index];
            
            pointCloneQuery += `
              {
                <${oldPointIri}> ?p ?o .
                FILTER(?p != cim:DiagramObjectPoint.DiagramObject)
                FILTER(?p != cim:DiagramObjectPoint.DiagramObjectGluePoint)
                FILTER(?p != cim:DiagramObjectPoint.xPosition)
                FILTER(?p != cim:DiagramObjectPoint.yPosition)
                BIND(<${newPointIri}> AS ?newPoint)
              }
            `;
            
            // Add UNION except for the last one
            if (index < pointsResult.results.bindings.length - 1) {
              pointCloneQuery += ` UNION `;
            }
          }
        });
        
        // Complete the query
        pointCloneQuery += `
          }
        `;
        
        await this.executeUpdate(pointCloneQuery);
      }
      
      return {
        objectIris: Array.from(objectMapping.values()),
        pointIris: newPointIris
      };
    } catch (error) {
      console.error('Error in cloneObjectsWithOffset:', error);
      throw error;
    }
  }
}

// Create singleton instance for use throughout the application
export const sparqlService = new SparqlService('');