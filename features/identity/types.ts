export type DemoIdentityInput = "member" | "peer" | "admin";

export type IdentityRole = "member" | "admin";

/** A server-owned identity used only while the product is in Demo mode. */
export type DemoIdentity = {
  id: "demo-member" | "demo-peer" | "demo-admin";
  role: IdentityRole;
  displayName: string;
};

/** Generic identity boundary for services that will later use public-account auth. */
export type Session = {
  identity: DemoIdentity;
  expiresAt: number;
};
