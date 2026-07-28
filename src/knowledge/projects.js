export const PROJECTS = Object.freeze([
  {
    id: 'portfolio',
    name: 'Manav Agarwal Portfolio / ArcadeOS',
    repository: 'manav193/MY-PORTFOLIO',
    summary: 'Creative developer portfolio with project case studies, interactive experiences, ArcadeOS, and the original NIMO client.',
    aliases: ['portfolio', 'my portfolio', 'arcade os', 'arcadeos'],
    tags: ['portfolio', 'frontend', 'interactive', 'arcade']
  },
  {
    id: 'nimo',
    name: 'NIMO Core',
    repository: 'manav193/NIMO-CORE',
    summary: "Central project intelligence, conversation, provider-routing, and integration layer for Manav's public software ecosystem.",
    aliases: ['nimo', 'nimo ai', 'nimo assistant', 'nimo core'],
    tags: ['ai', 'assistant', 'platform', 'integration']
  },
  {
    id: 'toolverse',
    name: 'ToolVerse',
    repository: 'manav193/ToolVerse',
    summary: 'Privacy-first PWA containing browser-based PDF, image, text, developer, student, and calculator tools.',
    aliases: ['toolverse', 'tool verse', 'tools'],
    tags: ['pwa', 'tools', 'privacy', 'productivity']
  },
  {
    id: 'shift-zero',
    name: 'SHIFT-ZERO',
    repository: 'manav193/SHIFT-ZERO',
    summary: 'Godot game architecture and HUD system built around gravity shifting and changing gameplay rules.',
    aliases: ['shift zero', 'shift-zero', 'godot game'],
    tags: ['godot', 'game', 'hud', 'architecture']
  },
  {
    id: 'fate-ai',
    name: 'FATE-AI',
    repository: 'manav193/FATE-AI',
    summary: 'Multi-provider AI workspace with provider routing, account failover, and coding-agent ambitions.',
    aliases: ['fate ai', 'fate-ai', 'multi provider ai'],
    tags: ['ai', 'providers', 'workspace', 'agent']
  },
  {
    id: 'veldora-bites',
    name: 'VELDORA-BITES',
    repository: 'manav193/VELDORA-BITES',
    summary: 'Restaurant portfolio project with menu, cart, orders, offers, and simulated checkout flows.',
    aliases: ['veldora bites', 'velora bites', 'restaurant website'],
    tags: ['restaurant', 'ecommerce', 'ui', 'frontend']
  }
]);

export const PROJECT_IDS = new Set(PROJECTS.map(project => project.id));

export function getPublicKnowledgeText() {
  return PROJECTS.map(project => `- ${project.name}: ${project.summary} Repository: ${project.repository}.`).join('\n');
}
