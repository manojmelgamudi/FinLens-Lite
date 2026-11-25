import { handleApiRoute } from '../_handler';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handleApiRoute('/api/auth/session');
