export const ARCADE_OS_PROJECTS_SOURCE = Object.freeze({
  id: 'arcade-os-projects',
  application: 'MY-PORTFOLIO / Arcade OS',
  version: '3.0.0',
  projects: Object.freeze([
    {
      id: 'arcade-os', name: 'MY-PORTFOLIO / ArcadeOS', aliases: ['arcade os', 'arcadeos', 'arcade', 'cabinet', 'games os', 'retro games', 'game os', 'आर्केड'], category: 'system', type: 'interactive portfolio system',
      summary: 'A modular desktop-first browser operating system with playable games, creative tools, persistent profiles, cabinet customization, and unified input handlers.',
      technologies: ['Vanilla JS', 'Canvas 2D', 'Web Audio API', 'PWA', 'Gamepad API'], capabilities: ['navigate Arcade OS', 'discover projects', 'open case studies'], limitations: ['The live cabinet is available on desktop and laptop only.'],
      routes: { open: '#intro-sequence', caseStudy: 'project-arcade-os.html' }, supportedActions: ['lookup', 'navigate', 'arcade-event']
    },
    {
      id: 'nimo', name: 'NIMO Assistant', aliases: ['nimo assistant', 'nimo ai', 'nimo project', 'नीमो'], category: 'system', type: 'interactive assistant system',
      summary: 'A local-first, website-aware assistant for navigation, project questions, case-study context, developer concepts, and English, Hindi, or Hinglish queries.',
      technologies: ['Vanilla JS', 'Intent NLU', 'Context Resolver', 'ES Modules'], capabilities: ['project lookup', 'follow-up resolution', 'structured navigation actions'], limitations: ['Remote AI is optional and host-controlled.'],
      routes: { open: '#nimo-widget', caseStudy: 'project-nimo.html' }, supportedActions: ['lookup', 'navigate']
    },
    {
      id: 'toolverse', name: 'ToolVerse', aliases: ['toolverse', 'tool verse', 'utility tools', 'टूलवर्स'], category: 'web', type: 'web application / PWA',
      summary: 'A privacy-first PWA delivering browser-based PDF, image, text, developer, student, and calculator tools.',
      technologies: ['HTML', 'CSS', 'Vanilla JS', 'Node SSG', 'Playwright'], capabilities: ['open the ToolVerse application', 'view the ToolVerse case study'], limitations: ['Individual tool capabilities require a ToolVerse-generated manifest.'],
      routes: { open: 'https://tool-verse-theta.vercel.app/', caseStudy: 'project-toolverse.html' }, supportedActions: ['lookup', 'navigate']
    },
    {
      id: 'shift-zero', name: 'SHIFT-ZERO', aliases: ['shift zero', 'shiftzero', 'gravity shift', 'शिफ्ट जीरो'], category: 'game', type: 'game architecture and HUD design',
      summary: 'A mobile-first Godot game foundation for one-touch gravity shifting and rule-changing modifiers with a high-contrast HUD.',
      technologies: ['Godot 4', 'GDScript', 'Python', 'CI'], capabilities: ['view project architecture', 'open the case study'], limitations: [], routes: { caseStudy: 'project-shift-zero.html' }, supportedActions: ['lookup', 'navigate']
    },
    {
      id: 'love', name: 'LOVE', aliases: ['love journey', 'narrative site', 'लव जर्नी'], category: 'web', type: 'narrative web experiment',
      summary: 'An immersive narrative website exploring paced scrolling, photography, ambient audio, and personal timeline storytelling.',
      technologies: ['HTML', 'CSS Grid', 'Canvas', 'Web Audio'], capabilities: ['open the case study'], limitations: [], routes: { caseStudy: 'project-love-journey.html' }, supportedActions: ['lookup', 'navigate']
    },
    {
      id: 'velora-bites', name: 'Velora Bites', aliases: ['velora', 'velora bites', 'restaurant ui', 'वेलोरा बाइट्स'], category: 'ui', type: 'UI/UX design prototype',
      summary: 'A responsive fine-dining interface concept translating luxury hospitality into a clear editorial reservation journey.',
      technologies: ['Figma', 'Responsive UI', 'Design Systems', 'Prototyping'], capabilities: ['open the case study'], limitations: [], routes: { caseStudy: 'project-velora-bites.html' }, supportedActions: ['lookup', 'navigate']
    },
    {
      id: 'nintendo', name: 'Nintendo UI', aliases: ['nintendo', 'nintendo ui', 'switch ui', 'निंटेंडो'], category: 'ui', type: 'gaming UI concept',
      summary: 'A conceptual Nintendo console interface redesign focused on visual density, navigation speed, and spatial interaction.',
      technologies: ['Figma', 'Console UI', 'UX Design', 'Design Systems'], capabilities: ['open the case study'], limitations: [], routes: { caseStudy: 'project-nintendo.html' }, supportedActions: ['lookup', 'navigate']
    },
    {
      id: 'nike', name: 'Nike Website UI', aliases: ['nike', 'nike ui', 'nike website', 'नाइकी'], category: 'ui', type: 'e-commerce UI concept',
      summary: 'A high-performance e-commerce interaction model focused on sports branding, dynamic typography, and product storytelling.',
      technologies: ['Figma', 'E-Commerce', 'Sports Branding', 'Motion UI'], capabilities: ['open the case study'], limitations: [], routes: { caseStudy: 'project-nike.html' }, supportedActions: ['lookup', 'navigate']
    }
  ])
});
