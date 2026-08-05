import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">DraftSense</p>
      <h1>Welcome back.</h1>
      <p>Sign in to securely access your leagues and draft room.</p>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={{ elements: { card: "clerk-card", headerTitle: "clerk-title" } }}
      />
    </main>
  );
}
