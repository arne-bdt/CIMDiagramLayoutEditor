/**
 * Utility functions for SPARQL operations
 */

/**
 * Get update endpoint URL from query endpoint
 * 
 * @param endpoint - SPARQL query endpoint
 * @returns SPARQL update endpoint
 */
export function getSparqlUpdateEndpoint(endpoint: string): string {
    if (!endpoint) throw new Error('Invalid endpoint');
    
    // If URL already ends with /update, use it as is
    if (endpoint.endsWith('/update')) {
      return endpoint;
    }
    
    // Otherwise append /update
    return endpoint + (endpoint.endsWith('/') ? 'update' : '/update');
  }
  
  /**
   * Validate that the endpoint is properly formatted
   * 
   * @param url - URL to validate
   * @returns True if URL is valid
   */
  export function isValidEndpoint(url: string): boolean {
    if (!url || url.trim() === '') return false;
    
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Build a query to get all diagrams
   * 
   * @param cimNamespace - CIM namespace
   * @returns SPARQL query
   */
  export function buildDiagramsQuery(cimNamespace: string): string {
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?diagram ?name
      WHERE {
         ?diagram rdf:type cim:Diagram .
          OPTIONAL {
              ?diagram cim:IdentifiedObject.name ?name .
          }
      }
      ORDER BY ?name
    `;
  }
  
  /**
   * Build a query to get diagram layout data
   * 
   * @param diagramIri - Diagram IRI
   * @param cimNamespace - CIM namespace
   * @returns SPARQL query
   */
  export function buildDiagramLayoutQuery(diagramIri: string, cimNamespace: string): string {
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      SELECT ?diagramObject ?point ?xPosition ?yPosition ?sequenceNumber ?drawingOrder ?isPolygon ?isTextDiagramObject ?textContent
      WHERE { 
      
      ?diagramObject cim:DiagramObject.Diagram <${diagramIri}> . 
      
      ?diagramObject rdf:type ?type. 
      BIND(?type = cim:TextDiagramObject AS ?isTextDiagramObject) .
      FILTER(?type IN (cim:DiagramObject, cim:TextDiagramObject)) .
  
      OPTIONAL {
          ?diagramObject cim:DiagramObject.drawingOrder ?drawOrd .
      }
      BIND(IF(bound(?drawOrd), xsd:integer(?drawOrd), 0) AS ?drawingOrder) .   
  
      ?point cim:DiagramObjectPoint.DiagramObject ?diagramObject;
             cim:DiagramObjectPoint.xPosition ?x;
             cim:DiagramObjectPoint.yPosition ?y .
      BIND(xsd:float(?x) AS ?xPosition) .
      BIND(xsd:float(?y) AS ?yPosition) .
  
  
      OPTIONAL {
          ?point cim:DiagramObjectPoint.sequenceNumber ?seqNum .
      }
      BIND(IF(bound(?seqNum), xsd:integer(?seqNum), 0) AS ?sequenceNumber) .   
  
      OPTIONAL {
          ?diagramObject cim:DiagramObject.isPolygon ?isPoly .
      }
      BIND(IF(bound(?isPoly), xsd:boolean(?isPoly), false) AS ?isPolygon) .   
      
      OPTIONAL {
          ?diagramObject cim:TextDiagramObject.text ?text .
      }
      BIND(IF(bound(?text), ?text, "") AS ?textContent) .
      }
      ORDER BY ?drawingOrder ?sequenceNumber
    `;
  }
  
  /**
   * Build an update query to update point positions
   * 
   * @param pointIris - Array of point IRIs
   * @param dx - X delta
   * @param dy - Y delta
   * @param cimNamespace - CIM namespace
   * @returns SPARQL update query
   */
  export function buildUpdatePointsQuery(
    pointIris: string[],
    dx: number,
    dy: number,
    cimNamespace: string
  ): string {
    // Create VALUES clause
    let valuesClause = 'VALUES ?point {\n';
    pointIris.forEach(iri => {
      valuesClause += `  <${iri}>\n`;
    });
    valuesClause += '}\n';
    
    return `
      PREFIX cim: <${cimNamespace}>                    
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      DELETE {
          ?point cim:DiagramObjectPoint.xPosition ?oldX .
          ?point cim:DiagramObjectPoint.yPosition ?oldY .
      }
      INSERT {
          ?point cim:DiagramObjectPoint.xPosition ?newX .
          ?point cim:DiagramObjectPoint.yPosition ?newY .
      }
      WHERE {
          ${valuesClause}
          ?point cim:DiagramObjectPoint.xPosition ?oldX .
          ?point cim:DiagramObjectPoint.yPosition ?oldY .
          
          BIND(xsd:float(?oldX) + ${dx} AS ?newX)
          BIND(xsd:float(?oldY) + ${dy} AS ?newY)
      }                     
    `;
  }