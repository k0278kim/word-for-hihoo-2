import { WordVocabulary } from "@/app/_components/WordVocabulary";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="min-h-screen bg-neutral-50">
        <WordVocabulary />
      </main>
    </HydrateClient>
  );
}
