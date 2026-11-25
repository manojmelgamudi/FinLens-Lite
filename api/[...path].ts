import { createApiApp } from '../server/apiApp';

export const config = {
  api: {
    bodyParser: false,
  },
};

const app = createApiApp();

export default app;
