export function createAdaptiveRecommendations({ now = Date.now, cooldownMs = 180000, moduleThreshold = 3 } = {}) {
  const lastShown = new Map();
  const dismissed = new Set();
  const eligible = key => !dismissed.has(key) && now() - (lastShown.get(key) || 0) >= cooldownMs;
  const mark = recommendation => { if (recommendation) lastShown.set(recommendation.key, now()); return recommendation; };
  return {
    recommend(summary, preferences = {}) {
      if (preferences.nimoSuggestions === false || preferences.adaptiveInterface === false) return null;
      const frequent = summary.frequentModules?.[0];
      if (frequent && !summary.pinnedModules?.includes(frequent)) {
        const key = `pin:${frequent}`;
        if (eligible(key)) return mark({ key, type: 'pin-module', moduleId: frequent, text: `You often open ${frequent}. Pin it to quick access?` });
      }
      if (summary.interactionMode === 'keyboard-primary' && eligible('hint:keyboard')) {
        return mark({ key: 'hint:keyboard', type: 'shortcut-hint', text: 'Prefer keyboard navigation? Press Ctrl+K to open system search.' });
      }
      const category = summary.preferredCategories?.[0];
      if (category && eligible(`category:${category}`)) return mark({ key: `category:${category}`, type: 'related-category', category, text: `Explore more ${category} projects when you are ready.` });
      return null;
    },
    dismiss(key) { if (typeof key === 'string') dismissed.add(key); },
    reset() { lastShown.clear(); dismissed.clear(); },
    moduleThreshold
  };
}
