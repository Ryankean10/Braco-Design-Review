import { Resend } from 'resend'

/**
 * Returns the correct Resend client and from address for a given company.
 * - scotplant: uses RESEND_API_KEY (scotplant account) + scotplantai@yacht-gitana.com
 * - all others: uses RESEND_API_KEY_BRACO (braco/safet account) + admin@safetconsultancy.co.uk
 */
export function getResendClient(companySlug: string | null): { resend: Resend; fromEmail: string } {
  if (companySlug === 'scotplant') {
    return {
      resend: new Resend(process.env.RESEND_API_KEY!),
      fromEmail: 'Scotplant MRRK <scotplantai@yacht-gitana.com>',
    }
  }
  return {
    resend: new Resend(process.env.RESEND_API_KEY_BRACO!),
    fromEmail: 'MRRK <admin@safetconsultancy.co.uk>',
  }
}
