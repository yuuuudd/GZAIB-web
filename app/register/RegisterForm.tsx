"use client";

import { useState } from "react";

function PasswordInput({ label, name }: { label: string; name: string }) {
  const [visible, setVisible] = useState(false);
  return <label>{label}<span className="auth-password-input">
    <input name={name} type={visible ? "text" : "password"} autoComplete="new-password" minLength={6} maxLength={18} required />
    <button type="button" aria-label={`${visible ? "隐藏" : "显示"}${label}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>👁</button>
  </span>{name === "password" ? <small>6–18 个字符</small> : null}</label>;
}

export function RegisterForm({ returnTo }: { returnTo: string }) {
  return <form action="/api/auth/register" method="post">
    <label>邮箱<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <PasswordInput label="密码" name="password" />
    <PasswordInput label="确认密码" name="confirmPassword" />
    <input name="returnTo" type="hidden" value={returnTo} />
    <button type="submit">创建账号</button>
  </form>;
}
