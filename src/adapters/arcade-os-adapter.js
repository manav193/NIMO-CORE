export function createArcadeOsAdapter({ source: providedSource = null, projects = [], version = '0.1.0', getContext = () => ({}) } = {}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const source = providedSource || {
    id: 'arcade-os',
    application: 'MY-PORTFOLIO / Arcade OS',
    version,
    projects: safeProjects.map(project => ({
      id: project.id,
      name: project.name,
      aliases: project.aliases || [],
      category: project.category,
      type: project.type,
      summary: project.summary,
      technologies: project.technologies || project.tech || [],
      capabilities: project.capabilities || [],
      routes: {
        ...(project.routes || {}),
        ...(project.caseStudy ? { caseStudy: project.caseStudy } : {}),
        ...(project.liveUrl ? { open: project.liveUrl } : {})
      },
      liveUrl: project.liveUrl,
      caseStudyUrl: project.caseStudyUrl || project.caseStudy,
      limitations: project.limitations || [],
      supportedActions: project.supportedActions || ['lookup', 'navigate'],
      sourceApplication: 'arcade-os',
      lastUpdatedVersion: version
    }))
  };
  return Object.freeze({
    id: 'arcade-os',
    kind: 'arcade-os',
    getSources: () => [source],
    getContext,
    actionContract: Object.freeze({
      navigation: Object.freeze({ type: 'navigate', target: 'host-defined route' }),
      event: Object.freeze({ type: 'arcade-event', event: 'host-defined event' })
    }),
    executeAction: undefined
  });
}
