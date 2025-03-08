<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let name: string;
    export let legend: string;
    export let options: { value: string; label: string }[] = [];
    export let value: string = '';
    export let disabled: boolean = false;
    
    const dispatch = createEventDispatcher();
    
    function handleChange(event: Event) {
      const target = event.target as HTMLInputElement;
      value = target.value;
      dispatch('change', { value });
    }
  </script>
  
  <fieldset class="radio-group">
    <legend>{legend}</legend>
    <div class="options">
      {#each options as option}
        <div class="radio-option">
          <input 
            type="radio"
            id={`${name}-${option.value}`}
            {name}
            value={option.value}
            checked={value === option.value}
            {disabled}
            on:change={handleChange}
          />
          <label for={`${name}-${option.value}`}>{option.label}</label>
        </div>
      {/each}
    </div>
  </fieldset>
  
  <style>
    .radio-group {
      border: none;
      padding: 0;
      margin: 0;
    }
    
    legend {
      font-weight: bold;
      font-size: 0.9rem;
      padding: 0;
      margin-bottom: var(--spacing-xs);
    }
    
    .options {
      display: flex;
      gap: var(--spacing-lg);
    }
    
    .radio-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }
    
    input[type="radio"] {
      margin: 0;
    }
    
    input[type="radio"]:disabled + label {
      color: var(--disabled-color);
      cursor: not-allowed;
    }
  </style>