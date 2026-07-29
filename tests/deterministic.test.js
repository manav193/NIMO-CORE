import { describe, expect, it } from 'vitest';
import { resolveDeterministicReply } from '../src/services/deterministic.js';

describe('resolveDeterministicReply', () => {
  it('answers exact technology ownership without a provider call', () => {
    const result = resolveDeterministicReply('Which project uses Playwright?', []);
    expect(result).toEqual({
      reply: 'ToolVerse uses Playwright.',
      source: 'deterministic_technology'
    });
  });

  it('returns a project technology stack for direct factual questions', () => {
    const result = resolveDeterministicReply('What technology does SHIFT-ZERO use?', []);
    expect(result?.reply).toContain('Godot 4');
    expect(result?.source).toBe('deterministic_project_stack');
  });

  it('does not intercept contextual follow-up conversations', () => {
    const history = [{ role: 'user', content: 'Compare ToolVerse and SHIFT-ZERO' }];
    expect(resolveDeterministicReply('Which one uses Godot?', history)).toBeNull();
  });
});
