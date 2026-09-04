import { handleRegistration } from "../../../../features/identity/password-auth";

export const POST = (request: Request) => handleRegistration(request);
