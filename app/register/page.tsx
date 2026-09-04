/* eslint-disable @next/next/no-html-link-for-pages -- Vinext has no Next runtime package. */
import { safeAccountReturnPath } from "../../features/identity/account-paths";

type AuthPageProps = { searchParams: Promise<{ return_to?: string; error?: string }> };

export default async function RegisterPage({ searchParams }: AuthPageProps) {
  const query = await searchParams;
  const returnTo = safeAccountReturnPath(query.return_to);
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="register-title">
    <a className="auth-brand" href="/">广州 AI 共创社</a>
    <p className="section-kicker">加入共建网络</p><h1 id="register-title">注册账号</h1>
    {query.error ? <p className="auth-error" role="alert">无法注册，请检查信息或登录已有账号。</p> : null}
    <form action="/api/auth/register" method="post">
      <label>邮箱<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>密码<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>至少 12 个字符</small></label>
      <input name="returnTo" type="hidden" value={returnTo} />
      <button type="submit">创建账号</button>
    </form>
    <p className="auth-switch">已有账号？<a href={`/login?return_to=${encodeURIComponent(returnTo)}`}>直接登录</a></p>
  </section></main>;
}
