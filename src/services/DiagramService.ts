import { 
    diagramData, 
    setLoading, 
    updateStatus, 
    resetViewTransform, 
    clearSelection,
    diagramList,
    cimNamespace,
    viewTransform
  } from './AppState';
  import { sparqlService } from './SparqlService';
  import { DiagramModel } from '../models/DiagramModel';
  import { CanvasSize, PointUpdateData, SparqlDiagramData } from '../models/types';
  import { 
    buildDiagramsQuery, 
    buildDiagramLayoutQuery,
    buildUpdatePointsQuery,
    isValidEndpoint
  } from '../utils/sparql';
  import { get } from 'svelte/store';
  import { addPaddingToBounds, calculateFitScale } from '../utils/geometry';
  import { AppConfig } from '../utils/config';
  
  /**
   * Service for handling diagram operations
   */
  class DiagramService {
    /**
     * Load all available diagrams
     * 
     * @param endpoint - SPARQL endpoint URL
     * @returns Array of diagram objects
     */
    async loadDiagramProfiles(endpoint: string): Promise<SparqlDiagramData[]> {
      if (!isValidEndpoint(endpoint)) {
        throw new Error('Please enter a valid SPARQL endpoint URL');
      }
      
      setLoading(true);
      updateStatus('Loading diagram profiles...');
      
      try {
        // Set endpoint in SPARQL service
        sparqlService.setEndpoint(endpoint);
        
        // Get current namespace
        const namespace = get(cimNamespace);
        
        // Build and execute query
        const query = buildDiagramsQuery(namespace);
        const response = await sparqlService.executeQuery(query);
        
        if (response.results.bindings.length === 0) {
          updateStatus('No diagrams found');
          diagramList.set([]);
          return [];
        }
        
        // Process results
        const diagrams = response.results.bindings.map(binding => ({
          iri: binding.diagram.value,
          name: binding.name ? binding.name.value : binding.diagram.value
        }));
        
        // Update diagram list
        diagramList.set(diagrams);
        updateStatus(`Found ${diagrams.length} diagrams`);
        
        return diagrams;
      } catch (error) {
        console.error('Error loading diagram profiles:', error);
        updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      } finally {
        setLoading(false);
      }
    }
    
    /**
     * Load and process diagram layout data
     * 
     * @param diagramIri - Diagram IRI
     * @returns Processed diagram model
     */
    async loadDiagramLayout(diagramIri: string): Promise<DiagramModel> {
      if (!diagramIri) {
        throw new Error('Please select a diagram');
      }
      
      setLoading(true);
      updateStatus('Loading diagram layout data...');
      
      try {
        // Reset view and selection
        resetViewTransform();
        clearSelection();
        
        // Get current namespace
        const namespace = get(cimNamespace);
        
        // Build and execute query
        const query = buildDiagramLayoutQuery(diagramIri, namespace);
        const response = await sparqlService.executeQuery(query);
        
        // Process diagram data
        const diagram = DiagramModel.fromSparqlResults(response);
        
        // Update diagram data
        diagramData.set(diagram);
        
        updateStatus(`Loaded diagram with ${diagram.objects.length} objects and ${diagram.points.length} points`);
        
        return diagram;
      } catch (error) {
        console.error('Error loading diagram layout data:', error);
        updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      } finally {
        setLoading(false);
      }
    }
    
    /**
     * Update point positions in the diagram
     * 
     * @param updateData - Data for position update
     * @returns Success status
     */
    async updatePointPositions(updateData: PointUpdateData): Promise<boolean> {
      const { points, dx, dy } = updateData;
      
      if (points.length === 0) {
        return true;
      }
      
      setLoading(true);
      updateStatus('Updating point positions...');
      
      try {
        // Get current namespace
        const namespace = get(cimNamespace);
        
        // Build and execute query
        const query = buildUpdatePointsQuery(points, dx, dy, namespace);
        await sparqlService.executeUpdate(query);
        
        updateStatus(`Updated ${points.length} points`);
        return true;
      } catch (error) {
        console.error('Error updating point positions:', error);
        updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      } finally {
        setLoading(false);
      }
    }
    
    /**
     * Auto-fit the diagram to the canvas
     * 
     * @param canvasSize - Canvas size
     */
    autoFitDiagram(canvasSize: CanvasSize): void {
      const diagram = get(diagramData);
      
      if (!diagram || diagram.points.length === 0) {
        resetViewTransform();
        return;
      }
      
      // Get diagram bounds
      const bounds = diagram.getBounds();
      
      // Add padding
      const paddedBounds = addPaddingToBounds(bounds, AppConfig.view.padding);
      
      // Calculate scale
      const scale = calculateFitScale(
        paddedBounds,
        canvasSize.width,
        canvasSize.height,
        1.0 // Max scale
      );
      
      // Update view transform
      viewTransform.set({
        scale,
        offsetX: -paddedBounds.minX * scale,
        offsetY: -paddedBounds.minY * scale
      });
    }
  }
  
  // Create singleton instance for use throughout the application
  export const diagramService = new DiagramService();