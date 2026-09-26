const SENSITIVE_ACTIONS = new Set([
  'send', 'delete', 'remove', 'export', 'publish', 'share'
]);

export function evaluateExecutionPolicy({
  action,
  scopes = [],
  requiresApproval = false,
  approved = false
} = {}) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  const sensitive = SENSITIVE_ACTIONS.has(normalizedAction);

  if (sensitive && requiresApproval && !approved) {
    return { allowed: false, reason: 'APPROVAL_REQUIRED', sensitive: true };
  }

  return {
    allowed: true,
    reason: 'ALLOWED',
    sensitive,
    scopes: [...new Set((scopes || []).map(String))]
  };
}
