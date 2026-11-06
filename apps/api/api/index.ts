import { handle } from 'hono/vercel';
import { createApp } from '../src/app';
import { loadEnv } from '../src/config/env';

export default handle(createApp(loadEnv()));
