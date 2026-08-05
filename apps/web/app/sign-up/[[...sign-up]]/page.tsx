import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">DraftSense</p>
      <h1>Build your draft edge.</h1>
      <p>Create an account, then connect a league when you are ready.</p>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        appearance={{ elements: { card: "clerk-card", headerTitle: "clerk-title" } }}
      />
    </main>
  );
}
