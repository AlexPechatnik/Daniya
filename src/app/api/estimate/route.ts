import { NextRequest, NextResponse } from "next/server";
import { calculateEstimate } from "@/app/actions";

export async function POST(req: NextRequest) {
  const { serviceId, cartridgeId, quantity } = await req.json();
  const result = await calculateEstimate(serviceId, cartridgeId ?? null, Number(quantity) || 1);
  return NextResponse.json(result);
}
