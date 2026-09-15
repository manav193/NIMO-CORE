import { createNimoEngine, createToolVerseAdapter } from '../../src/index.js';

const manifest = {
  version: '1.0.0',
  tools: [{
    id: 'compress-image',
    name: 'Compress Image',
    category: 'image',
    description: 'Reduce an image file size locally.',
    route: 'tools/compress-image.html',
    keywords: ['compress', 'image', 'target size'],
    acceptedFormats: ['image/jpeg', 'image/png'],
    outputFormats: ['image/jpeg'],
    processingMode: 'local',
    capabilities: ['reduce image file size'],
    limitations: []
  }]
};

export const nimo = createNimoEngine({ adapters: [createToolVerseAdapter(manifest)] });
