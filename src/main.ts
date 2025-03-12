import './styles/global.css';
import { mount } from 'svelte';
import App from './App.svelte';

// Wait for DOM to be ready
const app = mount(App, { target: document.getElementById("app") as HTMLElement});

console.log('CGMES DiagramLayout Editor initialized');

export default app;