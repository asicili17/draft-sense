import { DraftAssistant } from "../components/draft-assistant";
import { AccountControl } from "../components/account-control";
export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">DraftSense</p>
      <AccountControl />
      <h1>Make the next pick with confidence.</h1>
      <p>Connect a Sleeper league to get transparent, roster-aware draft recommendations.</p>
      <DraftAssistant />
    </main>
  );
}
