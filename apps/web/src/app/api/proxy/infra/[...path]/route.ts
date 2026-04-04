import { NextRequest, NextResponse } from "next/server";

const INFRA_AGENT_URL = process.env.INFRA_AGENT_URL || "http://localhost:4000";
const INFRA_AGENT_SECRET = process.env.INFRA_AGENT_SECRET || "";

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
) {
  const infraPath = path.join("/");
  const queryString = request.nextUrl.search;
  const url = `${INFRA_AGENT_URL}/infra/${infraPath}${queryString}`;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${INFRA_AGENT_SECRET}`,
    };

    const options: RequestInit = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json";
      const body = await request.text();
      if (body) options.body = body;
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Infra agent returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to infra agent" },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "POST");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "DELETE");
}
