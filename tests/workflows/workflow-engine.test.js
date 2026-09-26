import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../../src/providers/provider-registry.js';
import { createConnectorRegistry } from '../../src/connectors/connector-registry.js';
import { createWorkflowEngine } from '../../src/workflows/workflow-engine.js';

test('workflow chains provider output into connector input state', async () => {
  const providers = createProviderRegistry();
  const connectors = createConnectorRegistry();

  providers.register({ id: 'summarizer', name: 'Summarizer', capabilities: ['chat'] }, {
    async execute({ state }) {
      return { summary: state.input.message.toUpperCase() };
    }
  });

  connectors.register({ id: 'mailer', name: 'Mailer', capabilities: ['email'], scopes: ['email.send'] }, {
    async execute({ input, state }) {
      return { sent: true, body: input?.body || state.output?.summary };
    }
  });

  const engine = createWorkflowEngine({ providers, connectors });
  const result = await engine.run({
    id: 'message-to-email',
    steps: [
      { id: 'summarize', provider: 'summarizer' },
      { id: 'send', connector: 'mailer', action: 'send' }
    ]
  }, { message: 'hello world' });

  assert.equal(result.steps.summarize.result.summary, 'HELLO WORLD');
  assert.equal(result.steps.send.result.sent, true);
  assert.equal(result.output.body, 'HELLO WORLD');
});

test('approval gate blocks unapproved sensitive step', async () => {
  const providers = createProviderRegistry();
  const connectors = createConnectorRegistry();
  connectors.register({ id: 'mailer', name: 'Mailer', capabilities: ['email'] }, {
    async execute() { return { sent: true }; }
  });

  const engine = createWorkflowEngine({ providers, connectors });
  await assert.rejects(() => engine.run({
    id: 'approval-test',
    steps: [{ id: 'send', connector: 'mailer', action: 'send', requiresApproval: true }]
  }, {}, { approvals: {} }), /Approval required/);
});
