export class TooltipQueryBuilder {
    /**
     * Build a query to fetch detailed point information for tooltips
     */
    buildPointDetailsQuery(pointIri: string, cimNamespace: string): string {
      return `
        PREFIX cim: <${cimNamespace}>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?diagramObject ?objectName ?pointName ?zPosition ?offsetX ?offsetY ?rotation ?style ?styleName
        WHERE {
          <${pointIri}> cim:DiagramObjectPoint.DiagramObject ?diagramObject .
          
          # Optional DiagramObject name
          OPTIONAL {
            ?diagramObject cim:IdentifiedObject.name ?objectName .
          }
          
          # Optional DiagramObjectPoint name
          OPTIONAL {
            <${pointIri}> cim:IdentifiedObject.name ?pointName .
          }
          
          # Optional z position
          OPTIONAL {
            <${pointIri}> cim:DiagramObjectPoint.zPosition ?zPosition .
          }
          
          # Optional offset properties
          OPTIONAL {
            ?diagramObject cim:DiagramObject.offsetX ?offsetX .
          }
          
          OPTIONAL {
            ?diagramObject cim:DiagramObject.offsetY ?offsetY .
          }
          
          # Optional rotation property
          OPTIONAL {
            ?diagramObject cim:DiagramObject.rotation ?rotation .
          }
          
          # Optional style reference
          OPTIONAL {
            ?diagramObject cim:DiagramObject.DiagramObjectStyle ?style .
            OPTIONAL {
              ?style cim:IdentifiedObject.name ?styleName .
            }
          }
        }
        LIMIT 1
      `;
    }
  }