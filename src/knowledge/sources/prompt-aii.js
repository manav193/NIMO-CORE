/**
 * Prompt-Aii knowledge source.
 *
 * This is the runtime-facing project contract mirrored from the approved
 * NIMO-KNOWLEDGE catalog entry. It describes capabilities and integration
 * boundaries; it does not contain private user data or provider secrets.
 */
export const PROMPT_AII_SOURCE = Object.freeze({
  id: 'prompt-aii',
  version: '1.0.0',
  application: 'prompt-aii',
  projects: [
    {
      id: 'prompt-aii',
      name: 'Prompt-Aii',
      aliases: ['promptai', 'prompt-ai', 'prompt engineering lab'],
      category: 'prompt-engineering',
      type: 'workbench',
      summary: 'Model-aware prompt engineering workbench for deep prompts, reverse prompting, multi-model adaptation, and Promplets.',
      technologies: ['React', 'FastAPI', 'NIMO-CORE', 'OpenRouter'],
      capabilities: [
        'deep prompt engineering',
        'model-specific prompt generation',
        'reasoning prompt design',
        'coding-agent prompt design',
        'image prompt design',
        'reverse prompt analysis',
        'Promplet patterns',
        'prompt evaluation'
      ],
      routes: {
        open: '/',
        nimoChatTest: '/nimo-chat',
        generate: '/generate',
        reversePrompt: '/reverse-prompt'
      },
      limitations: [
        'Authentication UI may be temporarily hidden during development.',
        'Prompt quality must be evaluated; longer prompts are not inherently better.',
        'Private user conversations must never become active NIMO knowledge.'
      ],
      supportedActions: [
        'generate_model_specific_prompt',
        'generate_deep_reasoning_prompt',
        'generate_coding_agent_prompt',
        'generate_image_prompt',
        'reverse_prompt_image',
        'adapt_promplet'
      ],
      keywords: [
        'prompt',
        'prompt engineering',
        'deep prompt',
        'reverse prompt',
        'Promplet',
        'Codex prompt',
        'Claude coding prompt',
        'ChatGPT reasoning prompt',
        'Midjourney prompt',
        'Flux prompt'
      ],
      outputFormats: ['structured prompt', 'markdown', 'model-specific prompt'],
      processingMode: 'model-aware',
      sourceApplication: 'prompt-aii',
      lastUpdatedVersion: '1.0.0',
      metadata: {
        knowledgeCatalog: 'manav193/NIMO-KNOWLEDGE',
        approvedKnowledge: ['kno-20260917-prompt-aii-deep-prompt-engineering'],
        learningMode: 'governed-knowledge-augmentation'
      }
    }
  ]
});
