<script lang="ts">
    
     // Props
     let { 
        id,
        label,
        options = [],
        value = '',
        disabled,
        placeholder,
        required,
        change } 
        : {
        id: string,
        label: string,
        options: { value: string; label: string }[],
        value: string,
        disabled: boolean,
        placeholder: string,
        required: boolean,
        change: (value: string) => void
     } = $props();
    
    function handleChange(event: Event) {
      const target = event.target as HTMLSelectElement;
      value = target.value;
      change(value);
    }
  </script>
  
  <div class="select-wrapper">
    <label for={id}>{label}</label>
    <select
      {id}
      {disabled}
      {required}
      onchange={handleChange}
      value={value}
    >
      {#if placeholder}
        <option value="" disabled selected={!value}>{placeholder}</option>
      {/if}
      {#each options as option}
        <option value={option.value} selected={value === option.value}>
          {option.label}
        </option>
      {/each}
    </select>
  </div>
  
  <style>
    .select-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }
    
    label {
      font-weight: bold;
      font-size: 0.9rem;
    }
    
    select {
      padding: var(--spacing-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 1rem;
      background-color: white;
    }
    
    select:focus {
      outline: 2px solid var(--primary-color);
      border-color: transparent;
    }
    
    select[disabled] {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }
  </style>