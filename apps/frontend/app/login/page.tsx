import type { Metadata } from "next";

import { PasskeyLoginForm } from "./passkey-login-form";

export const metadata: Metadata = {
  title: "Sign in · Fitracker",
  description: "Passkey sign-in for the Fitracker athlete app.",
};

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Phase 4 Athlete Auth</p>
        <h1>Sign in with passkey</h1>
        <p className="lede">
          Register a passkey on this device once. After that a tap is enough to
          start today's workout.
        </p>
      </section>

      <PasskeyLoginForm />
    </main>
  );
}
