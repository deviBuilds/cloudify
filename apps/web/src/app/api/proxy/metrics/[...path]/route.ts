import { NextRequest, NextResponse } from "next/server";

const INFRA_AGENT_URL = process.env.INFRA_AGENT_URL || "http://localhost:4000";
const INFRA_AGENT_SECRET = process.env.INFRA_AGENT_SECRET || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const metricsPath = path.join("/");
  const url = `${INFRA_AGENT_URL}/infra/metrics/${metricsPath}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${INFRA_AGENT_SECRET}`,
      },
    });

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
