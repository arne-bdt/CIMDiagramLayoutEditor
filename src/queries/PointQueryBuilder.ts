import type { MovePointsByDeltaData } from "@/core/models/types";

export class PointQueryBuilder {
    /**
     * Build a query to insert a new point
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
     * Build a query to update point positions relative by a vector
     */
    buildUpdateDiagramPointPositionsByVectorQuery(
      pointsAndVector: MovePointsByDeltaData,
      cimNamespace: string
    ): string {
      // Create VALUES clause
      let valuesClause = 'VALUES ?point {\n';
      pointsAndVector.pointIris.forEach(iri => {
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
            
            BIND(xsd:float(?oldX) + ${pointsAndVector.deltaVector.dx} AS ?newX)
            BIND(xsd:float(?oldY) + ${pointsAndVector.deltaVector.dy} AS ?newY)
        }                     
      `;
    }

    /**
     * Build a query to update point positions to absolute values
     */    
    buildUpdateDiagramPointPositionsQuery(
      pointIris: string[],
      positions: Array<{x: number, y: number}>,
      cimNamespace: string
    ): string {
      // Create VALUES clause
      let valuesClause = 'VALUES (?point ?x ?y) {\n';
      pointIris.forEach((iri, index) => {
        valuesClause += `  (<${iri}> "${positions[index].x}"^^xsd:float  "${positions[index].y}"^^xsd:float )\n`;
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
          ?point cim:DiagramObjectPoint.xPosition ?x .
          ?point cim:DiagramObjectPoint.yPosition ?y .
        }
        WHERE {
          ${valuesClause}
          ?point cim:DiagramObjectPoint.xPosition ?oldX .
          ?point cim:DiagramObjectPoint.yPosition ?oldY .
        }
      `;
    }

      
    
    /**
     * Build a query to update sequence numbers
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
     * Build a query to delete a point
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

  }