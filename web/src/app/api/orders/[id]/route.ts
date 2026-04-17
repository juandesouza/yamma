import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/orders/${id}`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { message: 'Orders service unavailable. Is the backend running?' },
      { status: 503 }
    );
  }
}
