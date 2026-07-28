export const PROJECTS = Object.freeze([
  {
    id: 'portfolio',
    name: 'Manav Agarwal Portfolio / ArcadeOS',
    repository: 'manav193/MY-PORTFOLIO',
    summary: 'Creative developer portfolio with project case studies, interactive experiences, ArcadeOS, and the original NIMO client.',
    aliases: ['portfolio', 'my portfolio', 'arcade os', 'arcadeos'],
    tags: ['portfolio', 'frontend', 'interactive', 'arcade'],
    technologies: ['HTML', 'CSS', 'Vanilla JavaScript', 'Canvas 2D', 'Web Audio API', 'PWA', 'Gamepad API']
  },
  {
    id: 'nimo',
    name: 'NIMO Core',
    repository: 'manav193/NIMO-CORE',
    summary: "Standalone Cloudflare Worker that provides bounded multi-turn conversation, verified public project intelligence, OpenRouter routing and failover, CORS controls, and safe error handling for Manav's portfolio assistant.",
    aliases: ['nimo', 'nimo ai', 'nimo assistant', 'nimo core'],
    tags: ['ai', 'assistant', 'cloudflare', 'integration'],
    technologies: ['Cloudflare Workers', 'JavaScript', 'OpenRouter API', 'GitHub Actions']
  },
  {
    id: 'toolverse',
    name: 'ToolVerse',
    repository: 'manav193/ToolVerse',
    summary: 'Privacy-first PWA containing 70+ browser-based PDF, image, text, developer, student, and calculator tools with local browser processing.',
    aliases: ['toolverse', 'tool verse', 'tools'],
    tags: ['pwa', 'tools', 'privacy', 'productivity'],
    technologies: ['HTML', 'CSS', 'Vanilla JavaScript', 'Node SSG', 'Playwright']
  },
  {
    id: 'shift-zero',
    name: 'SHIFT-ZERO',
    repository: 'manav193/SHIFT-ZERO',
    summary: 'Mobile-first Godot game foundation and high-contrast HUD system built around one-touch gravity shifting and rule-changing gameplay modifiers.',
    aliases: ['shift zero', 'shift-zero', 'godot game'],
    tags: ['godot', 'game', 'hud', 'architecture'],
    technologies: ['Godot 4', 'GDScript', 'Python', 'CI']
  },
  {
    id: 'fate-ai',
    name: 'FATE-AI',
    repository: 'manav193/FATE-AI',
    summary: 'Multi-provider AI workspace with provider routing, account failover, and coding-agent ambitions.',
    aliases: ['fate ai', 'fate-ai', 'multi provider ai'],
    tags: ['ai', 'providers', 'workspace', 'agent'],
    technologies: ['JavaScript', 'Node.js', 'Multi-provider APIs']
  },
  {
    id: 'veldora-bites',
    name: 'VELDORA-BITES',
    repository: 'manav193/VELDORA-BITES',
    summary: 'Restaurant portfolio project with menu, cart, orders, offers, coupons, and simulated checkout flows.',
    aliases: ['veldora bites', 'velora bites', 'restaurant website'],
    tags: ['restaurant', 'ecommerce', 'ui', 'frontend'],
    technologies: ['HTML', 'CSS', 'JavaScript']
  }
]);

export const PROJECT_IDS = new Set(PROJECTS.map(project => project.id));

export function getPublicKnowledgeText() {
  return PROJECTS.map(project => {
    const technologies = project.technologies?.length
      ? ` Technologies: ${project.technologies.join(', ')}.`
      : '';
    return `- ${project.name}: ${project.summary}${technologies} Repository: ${project.repository}.`;
  }).join('\n');
}
