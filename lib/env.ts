const minimumSessionSecretLength = 32;

export type RuntimeEnvironment = Record<string, string | undefined>;

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return process.env;
}

/** Rejects accidental deployment with a missing or trivially guessable signing secret. */
export function requireDemoSessionSecret(
  providedSecret?: string,
  environment: RuntimeEnvironment = getRuntimeEnvironment(),
): string {
  const secret = providedSecret ?? environment.DEMO_SESSION_SECRET;
  if (!secret || secret.length < minimumSessionSecretLength) {
    throw new Error("DEMO_SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}
