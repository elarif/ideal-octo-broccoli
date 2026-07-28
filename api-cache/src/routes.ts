export interface RoutePolicy {
  cacheable: boolean;
  ttl: number;
  swr: number;
}

const POLICIES: Array<{ re: RegExp; policy: RoutePolicy }> = [
  { re: /^\/wp-json\/wp\/v2\/posts\/\d+/, policy: { cacheable: true, ttl: 300, swr: 7200 } },
  { re: /^\/wp-json\/wp\/v2\/posts(\?|$)/, policy: { cacheable: true, ttl: 60, swr: 3600 } },
  { re: /^\/wp-json\/wp\/v2\/media/, policy: { cacheable: true, ttl: 3600, swr: 86400 } },
  { re: /^\/wp-json\/wp\/v2\/(taxonomies|categories|tags|auteur|voix|genre_livre|periode|region|licence)/,
    policy: { cacheable: true, ttl: 3600, swr: 86400 } },
  { re: /^\/wp-json\/wp\/v2\/pages\/\d+/, policy: { cacheable: true, ttl: 3600, swr: 86400 } },
];

const EXCLUDE = [
  /\/wp-admin\//,
  /\/wp-json\/wp\/v2\/users\/me/,
  /\/wp-json\/wp\/v2\/(comments)\?post=/,
  /\/xmlrpc\.php/,
];

export function matchRoute(pathname: string): RoutePolicy | null {
  if (EXCLUDE.some((re) => re.test(pathname))) return null;
  for (const { re, policy } of POLICIES) {
    if (re.test(pathname)) return policy;
  }
  if (pathname.startsWith("/wp-json/")) return { cacheable: true, ttl: 60, swr: 600 };
  return null;
}
