import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 有効なトークン値（管理者 / 閲覧専用）
const VALID_TOKENS = new Set(['authenticated', 'viewer']);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const tokenValue = request.cookies.get('admin_token')?.value;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!VALID_TOKENS.has(tokenValue ?? '')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (pathname === '/admin/login') {
    if (VALID_TOKENS.has(tokenValue ?? '')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
