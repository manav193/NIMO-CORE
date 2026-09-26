import { KnowledgeValidationError } from '../utils/validation.js';

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

export function validateWorkflow(workflow = {}) {
  if (!workflow || typeof workflow !== 'object') throw new KnowledgeValidationError('Workflow must be an object.');
  if (!workflow.id) throw new KnowledgeValidationError('Workflow requires id.');
  if (!Array.isArray(workflow.steps)) throw new KnowledgeValidationError('Workflow requires steps.');
  return workflow;
}

export class WorkflowEngine {
  constructor({ providers, connectors, policies = null, audit = null } = {}) {
    if (!providers) throw new KnowledgeValidationError('WorkflowEngine requires a provider registry.');
    if (!connectors) throw new KnowledgeValidationError('WorkflowEngine requires a connector registry.');
    this.providers = providers;
    this.connectors = connectors;
    this.policies = policies;
    this.audit = typeof audit === 'function' ? audit : null;
  }

  async run(workflow, input = {}, context = {}) {
    validateWorkflow(workflow);
    let state = { input: clone(input), output: null, steps: {}, context: clone(context) };

    for (const step of workflow.steps) {
      const started = Date.now();
      const providerId = step.provider || null;
      const connectorId = step.connector || null;

      if (step.requiresApproval && context.approvals?.[step.id] !== true) {
        throw new KnowledgeValidationError(`Approval required for step: ${step.id}`);
      }

      let result;
      if (providerId) {
        const client = this.providers.getClient(providerId);
        if (!client || typeof client.execute !== 'function') {
          throw new KnowledgeValidationError(`Provider is not executable: ${providerId}`);
        }
        result = await client.execute({
          ...clone(step.input || {}),
          state: clone(state),
          context: clone(context)
        });
      } else if (connectorId) {
        const client = this.connectors.getClient(connectorId);
        if (!client || typeof client.execute !== 'function') {
          throw new KnowledgeValidationError(`Connector is not executable: ${connectorId}`);
        }
        result = await client.execute({
          action: step.action || null,
          input: clone(step.input || {}),
          state: clone(state),
          context: clone(context)
        });
      } else {
        throw new KnowledgeValidationError(`Step requires provider or connector: ${step.id}`);
      }

      state.steps[step.id] = Object.freeze({
        result: clone(result),
        durationMs: Date.now() - started
      });
      state.output = clone(result);

      if (this.audit) {
        try {
          await this.audit({
            workflowId: workflow.id,
            stepId: step.id,
            providerId,
            connectorId,
            durationMs: Date.now() - started
          });
        } catch {
          // Audit failures never break the workflow.
        }
      }
    }

    return Object.freeze(state);
  }
}

export function createWorkflowEngine(options) {
  return new WorkflowEngine(options);
}
