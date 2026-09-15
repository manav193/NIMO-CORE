import { createNimoEngine, createProjectFederation } from '../../src/index.js';

const federation = createProjectFederation();
federation.registerModule({
  id: 'arcade-os', name: 'Arcade OS', version: '1.0.0', type: 'operating-system',
  description: 'A browser arcade system.', entry: '#intro-sequence',
  knowledge: 'arcade-os-knowledge.json', status: 'stable',
  capabilities: ['project discovery'], keywords: ['portfolio', 'arcade']
}, {
  id: 'arcade-os-knowledge', application: 'arcade-os', version: '1.0.0',
  projects: [{
    id: 'arcade-os', name: 'Arcade OS', aliases: ['arcade'], category: 'system',
    summary: 'A browser arcade system.', routes: { open: '#intro-sequence', caseStudy: 'project-arcade-os.html' }
  }]
});

export const nimo = createNimoEngine({ federation });
