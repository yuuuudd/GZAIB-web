async function handlers() {
  return (await import("../../../../features/connections/runtime-route")).createDefaultRuntimeConnectionRouteAdapter();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return (await handlers()).PATCH(request, context); }
