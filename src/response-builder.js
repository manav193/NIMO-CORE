const words = {
  en: { open: 'Open', caseStudy: 'View case study', unknown: 'I do not have enough verified information for that yet.', current: 'You are currently viewing' },
  hinglish: { open: 'Kholo', caseStudy: 'Case study dekho', unknown: 'Mere paas abhi uske baare mein verified information nahi hai.', current: 'Abhi tum yahan ho' },
  hi: { open: 'खोलें', caseStudy: 'केस स्टडी देखें', unknown: 'मेरे पास अभी उसके बारे में सत्यापित जानकारी नहीं है।', current: 'आप अभी यहाँ हैं' }
};

const action = (type, target, label, extra = {}) => Object.freeze({ type, target, label, ...extra });
const joinOrUnknown = (values, empty) => values?.length ? values.join(', ') : empty;

export function buildResponse(route, { language = 'en', registry, context = {}, query = '' } = {}) {
  const copy = words[language] || words.en;
  const project = route.project;
  const base = { intent: route.id, language, confidence: route.confidence, entity: project || null, actions: [], recommendations: [] };

  if (route.id === 'identity') {
    return { ...base, text: language === 'hi' ? 'मैं NIMO हूँ—एक local-first project intelligence और navigation companion।' : language === 'hinglish' ? 'Main NIMO hoon—local-first project intelligence aur navigation companion.' : 'I am NIMO, a local-first project intelligence and navigation companion.' };
  }
  if (route.id === 'arcade_event') {
    return { ...base, text: 'Arcade repair action prepared for the host.', actions: [action('arcade-event', null, 'Run repair', { event: route.event })] };
  }
  if (route.id === 'open_entity' && project) {
    const target = project.routes.open || project.liveUrl || project.caseStudyUrl;
    return target
      ? { ...base, text: `${copy.open}: ${project.name}`, actions: [action('navigate', target, `${copy.open} ${project.name}`)] }
      : { ...base, text: `${project.name} does not define an open route.`, confidence: 0.7 };
  }
  if (route.id === 'case_study' && project) {
    const target = project.routes.caseStudy || project.caseStudyUrl;
    return target
      ? { ...base, text: `${project.name}: ${project.summary}`, actions: [action('navigate', target, copy.caseStudy)] }
      : { ...base, text: `${project.name} does not currently provide a case-study route.` };
  }
  if (route.id === 'processing_mode' && project) {
    const mode = project.processingMode;
    return { ...base, text: mode ? `${project.name} processing mode: ${mode}.` : `${project.name} does not declare a processing mode.` };
  }
  if (route.id === 'formats' && project) {
    const accepted = joinOrUnknown(project.acceptedFormats, 'not declared');
    const output = joinOrUnknown(project.outputFormats, 'not declared');
    return { ...base, text: `${project.name} — accepted formats: ${accepted}; output formats: ${output}.` };
  }
  if (route.id === 'limitations' && project) {
    return { ...base, text: project.limitations.length ? `${project.name} limitations: ${project.limitations.join('; ')}` : `No limitations are declared for ${project.name}.` };
  }
  if (route.id === 'capability_help' && project) {
    return { ...base, text: project.capabilities.length ? `${project.name} can: ${project.capabilities.join('; ')}.` : `${project.name}: ${project.summary}` };
  }
  if (route.id === 'related' && project) {
    const list = typeof registry?.list === 'function' ? registry.list() : [];
    const related = list.filter(item => item.id !== project.id && item.category === project.category).slice(0, 3);
    return { ...base, text: related.length ? `Related to ${project.name}: ${related.map(item => item.name).join(', ')}.` : `No verified related utilities are registered for ${project.name}.`, recommendations: related };
  }
  if (route.id === 'project_lookup' && project) {
    const technologies = project.technologies?.length ? ` Technologies: ${project.technologies.join(', ')}.` : '';
    const actions = [];
    if (project.routes?.open || project.liveUrl) actions.push(action('navigate', project.routes?.open || project.liveUrl, `${copy.open} ${project.name}`));
    if (project.routes?.caseStudy || project.caseStudyUrl) actions.push(action('navigate', project.routes?.caseStudy || project.caseStudyUrl, copy.caseStudy));
    return { ...base, text: `${project.name} (${project.type}): ${project.summary}${technologies}`, actions };
  }
  if (route.id === 'recommendation') {
    const queryWords = query.toLowerCase().split(/\s+/);
    const list = typeof registry?.list === 'function' ? registry.list() : [];
    const recommendations = list.map(item => ({
      item,
      score: [...(item.keywords || []), ...(item.capabilities || []), item.name, item.summary].reduce((score, value) => score + (queryWords.some(word => word.length > 2 && String(value).toLowerCase().includes(word)) ? 1 : 0), 0)
    })).filter(result => result.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(result => result.item);
    return { ...base, text: recommendations.length ? `Recommended: ${recommendations.map(item => item.name).join(', ')}.` : copy.unknown, recommendations };
  }
  if (route.id === 'current_context') {
    const location = context.currentPage || context.currentSection;
    return { ...base, text: `${copy.current}: ${location}.` };
  }
  return { ...base, text: copy.unknown };
}
