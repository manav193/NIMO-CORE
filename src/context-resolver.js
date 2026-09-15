export class ContextResolver {
  #lastProjectId = null;
  #lastIntent = null;

  resolve({ explicitProject = null, hostContext = {}, query = '' } = {}) {
    const followUp = /\b(it|this|that|same|current|related|iske|iska|yeh|यह|इस)\b/i.test(query);
    const projectId = explicitProject?.id
      || hostContext.currentProjectId
      || (followUp ? this.#lastProjectId : null)
      || null;
    return Object.freeze({
      projectId,
      currentPage: hostContext.currentPage || null,
      currentSection: hostContext.currentSection || null,
      lastIntent: this.#lastIntent,
      followUp
    });
  }

  remember({ intent, projectId }) {
    if (projectId) this.#lastProjectId = projectId;
    if (intent) this.#lastIntent = intent;
  }

  snapshot() {
    return Object.freeze({ lastProjectId: this.#lastProjectId, lastIntent: this.#lastIntent });
  }

  reset() {
    this.#lastProjectId = null;
    this.#lastIntent = null;
  }
}
