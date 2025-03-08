<script lang="ts">
    export let id: string;
    export let label: string;
    export let value: string = '';
    export let placeholder: string = '';
    export let disabled: boolean = false;
    export let type: string = 'text';
    export let required: boolean = false;
    
    function handleInput(event: Event) {
      const target = event.target as HTMLInputElement;
      value = target.value;
    }
  </script>
  
  <div class="input-wrapper">
    <label for={id}>{label}</label>
    <input
      {id}
      {type}
      {placeholder}
      {disabled}
      {required}
      {value}
      on:input={handleInput}
      on:blur
      on:focus
    />
  </div>
  
  <style>
    .input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }
    
    label {
      font-weight: bold;
      font-size: 0.9rem;
    }
    
    input {
      padding: var(--spacing-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 1rem;
    }
    
    input:focus {
      outline: 2px solid var(--primary-color);
      border-color: transparent;
    }
    
    input[disabled] {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }
  </style>