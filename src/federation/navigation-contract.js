export function createModuleNavigationAction(module, destination = 'open') {
  if (!module) return null;
  const target = destination === 'open' ? module.entry : module.navigation[destination];
  if (!target) return null;
  return Object.freeze({ type: 'module-navigation', moduleId: module.id, destination, target, executed: false });
}
