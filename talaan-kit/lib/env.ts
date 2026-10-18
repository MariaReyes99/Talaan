/**
 * Talaan settings guard. Every server route calls assertTalaanEnv() first, so the app
 * refuses to run with another project's settings (for example the Investment Research Library's).
 * Checked inside each request, not at import, so `next build` works without secrets.
 */
export const TALAAN_APP_ID = 'talaan';
export const TALAAN_VECTOR_NAMESPACE = 'talaan-ph-payroll';

export class TalaanEnvError extends Error {}

export function assertTalaanEnv() {
  if (process.env.APP_ID !== TALAAN_APP_ID) {
    throw new TalaanEnvError('Wrong environment: APP_ID is not "talaan". Check .env.local or the talaan project in Vercel.');
  }
  if (process.env.VECTOR_NAMESPACE !== TALAAN_VECTOR_NAMESPACE) {
    throw new TalaanEnvError('Talaan must use VECTOR_NAMESPACE=talaan-ph-payroll.');
  }
}

/** Reads a required setting, with a message that says where to add it. */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new TalaanEnvError(`Missing ${name}. Add it to Talaan's .env.local and to the talaan project in Vercel.`);
  return v;
}

/** The public web address of this Talaan deployment, without a trailing slash. */
export function siteUrl(): string {
  return required('NEXT_PUBLIC_SITE_URL').replace(/\/+$/, '');
}

/** Turns a settings problem into a clear 500 response instead of a crash. */
export function envErrorResponse(e: unknown) {
  if (e instanceof TalaanEnvError) return Response.json({ error: e.message }, { status: 500 });
  throw e;
}
