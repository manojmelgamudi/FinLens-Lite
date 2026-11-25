import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/apiApp';

const app = createApiApp();

export function handleApiRoute(defaultPath: string) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url || req.url === '/' || !req.url.startsWith('/api/')) {
      req.url = defaultPath;
    }
    return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  };
}
