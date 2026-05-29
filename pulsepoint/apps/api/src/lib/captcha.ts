export async function verifyCaptcha(_token: string | undefined): Promise<boolean> {
  void _token;
  // Demo seam only: production would call Cloudflare Turnstile /siteverify here.
  return true;
}
