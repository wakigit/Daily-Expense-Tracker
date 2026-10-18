import { handleRoast } from '../../backend/src/routes.js';
import { MAX_ROAST_BYTES } from '../../src/lib/roastContract.js';
import { withGuards } from '../_shared.js';

// Best-effort per instance, not a distributed cost ceiling.
export default withGuards({ maxBytes: MAX_ROAST_BYTES, limit: 10, handler: handleRoast });
