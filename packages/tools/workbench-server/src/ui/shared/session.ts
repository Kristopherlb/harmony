export function getSessionId(): string {
  const v = new URLSearchParams(window.location.search).get('sessionId') ?? '';
  return v;
}

export function getProvider(): string {
  return (new URLSearchParams(window.location.search).get('provider') ?? 'github').toLowerCase();
}

