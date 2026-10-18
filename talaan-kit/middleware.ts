import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Language routing (/en, /tl, /zh). If the app also uses Clerk, wrap it:
 *   import { clerkMiddleware } from '@clerk/nextjs/server';
 *   const intl = createMiddleware(routing);
 *   export default clerkMiddleware((auth, req) => intl(req));
 */
export default createMiddleware(routing);

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
