# CGMES DiagramLayout Editor (Svelte & TypeScript)

A modern web application for editing CGMES diagram layouts using Svelte and TypeScript.

## Features

- View and edit diagram layouts from SPARQL endpoints
- Interactive canvas with panning, zooming, selecting, and dragging
- Support for CGMES versions 2.4.15 and 3.0
- Real-time updates of point positions via SPARQL
- Responsive design that adapts to different screen sizes

## Architecture

This application follows a clean architecture with separation of concerns:

- **Models**: Define data structures and business logic
- **Services**: Handle application state and external communication
- **Components**: Render the UI and handle user interactions
- **Utils**: Provide utility functions for specific domains
- **Actions**: Define Svelte actions for DOM interactions

## Development

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cgmes-editor-svelte.git
cd cgmes-editor-svelte

# Install dependencies
npm install
# or
yarn install
```

### Development Server

```bash
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:3000

### Building for Production

```bash
npm run build
# or
yarn build
```

This will create a production-ready build in the `dist` directory.

## Usage

1. Enter the SPARQL endpoint URL in the configuration panel
2. Select CGMES version (2.4.15 or 3.0)
3. Click "Load diagram profiles" to fetch available diagrams
4. Select a diagram from the dropdown
5. Click "Render diagram" to display the diagram

### Canvas Interactions

- **Pan**: Click and drag on empty canvas space
- **Zoom**: Use mouse wheel
- **Select**: Hold Ctrl and click on points, or Ctrl+drag to select multiple points
- **Move**: Select points, then click and drag them

## Project Structure

```
cgmes-editor-svelte/
├── src/                      # Source code
│   ├── components/           # UI Components
│   ├── models/               # Data models
│   ├── services/             # Application services
│   ├── utils/                # Utility functions
│   ├── actions/              # Svelte actions
│   └── styles/               # CSS styles
├── public/                   # Static files
└── tests/                    # Tests
```

## Testing

```bash
npm run test
# or
yarn test
```

## License

[Apache-2.0 license](LICENSE)