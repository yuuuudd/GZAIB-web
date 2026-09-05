/* eslint-disable @next/next/no-html-link-for-pages -- Vinext has no Next runtime package. */
import { safeAccountReturnPath } from "../../features/identity/account-paths";

type AuthPageProps = { searchParams: Promise<{ return_to?: string; error?: string }> };

export default async function LoginPage({ searchParams }: AuthPageProps) {
  const query = await searchParams;
  const returnTo = safeAccountReturnPath(query.return_to);
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="login-title">
    <a className="auth-brand" href="/">广州 AI 共创社</a>
    <p className="section-kicker">欢迎回来</p><h1 id="login-title">登录账号</h1>
    {query.error ? <p className="auth-error" role="alert">邮箱或密码错误，请重新输入。</p> : null}
    <form action="/api/auth/login" method="post">
      <label>邮箱<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>密码<input name="password" type="password" autoComplete="current-password" minLength={6} maxLength={128} required /></label>
      <input name="returnTo" type="hidden" value={returnTo} />
      <button type="submit">登录</button>
    </form>
    <p className="auth-switch">还没有账号？<a href={`/register?return_to=${encodeURIComponent(returnTo)}`}>立即注册</a></p>
  </section></main>;
}
