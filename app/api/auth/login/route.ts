import { handlePasswordLogin } from "../../../../features/identity/password-auth";

export const POST = (request: Request) => handlePasswordLogin(request);
