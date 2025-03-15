<script lang="ts">
    // Show loading indicator when visible is true
    export let visible: boolean = false;
  </script>
  
  <div class="loading" class:visible>
    <div class="spinner"></div>
    <div class="text">Loading...</div>
  </div>
  
  <style>
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(255, 255, 255, 0.8);
      padding: var(--spacing-lg);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease-in-out;
      z-index: var(--z-loading);
    }
    
    .loading.visible {
      opacity: 1;
      pointer-events: auto;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s ease-in-out infinite;
    }
    
    .text {
      font-weight: bold;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>