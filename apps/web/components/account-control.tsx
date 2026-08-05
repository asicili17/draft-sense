"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export function AccountControl() {
  const { isSignedIn } = useAuth();
  return (
    <div className="account-control">
      {isSignedIn ? (
        <UserButton />
      ) : (
        <SignInButton mode="modal">
          <button type="button">Sign in</button>
        </SignInButton>
      )}
    </div>
  );
}
