async function handlers() {
  return (await import("../../../features/connections/runtime-route")).createDefaultRuntimeConnectionRouteAdapter();
}

export async function POST(request: Request) { return (await handlers()).POST(request); }
export async function GET(request: Request) { return (await handlers()).GET(request); }
