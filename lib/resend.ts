import { Resend } from 'resend'

/**
 * Returns the correct Resend client and from address for a given company.
 * - scotplant: uses RESEND_API_KEY (scotplant account) + scotplantai@yacht-gitana.com
 * - all others: uses RESEND_API_KEY_BRACO (braco/safet account) + admin@safetconsultancy.co.uk
 */
export function getResendClient(companySlug: string | null): { resend: Resend; fromEmail: string } {
  if (companySlug === 'scotplant') {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY not configured')
    return {
      resend: new Resend(key),
      fromEmail: 'Scotplant MRRK <scotplantai@yacht-gitana.com>',
    }
  }
  const key = process.env.RESEND_API_KEY_BRACO
  if (!key) throw new Error('RESEND_API_KEY_BRACO not configured')
  return {
    resend: new Resend(key),
    fromEmail: 'MRRK <admin@safetconsultancy.co.uk>',
  }
}
