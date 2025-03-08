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
}

// Create singleton instance for use throughout the application
export const sparqlService = new SparqlService('');