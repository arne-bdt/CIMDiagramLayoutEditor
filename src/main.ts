import './styles/global.css';
import App from './App.svelte';

// Wait for DOM to be ready
const app = new App({
  target: document.getElementById('app') || document.body,
});

console.log('CGMES DiagramLayout Editor initialized');

export default app;