import type { AdpImport, ProjectionImport } from "@draft-sense/providers";
export interface ImportPublicationRepository {
  publish(input: {
    provider: string;
    kind: "projection" | "adp";
    payloadHash: string;
    source: string;
    version: string;
  }): Promise<{ datasetId: string }>;
}
const hash = async (value: unknown) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
export class DatasetImportService {
  constructor(private readonly repository: ImportPublicationRepository) {}
  publishProjection(data: ProjectionImport) {
    return this.repository.publish({
      provider: data.source,
      kind: "projection",
      payloadHash: "pending-" + data.retrievedAt.getTime(),
      source: data.source,
      version: data.retrievedAt.toISOString(),
    });
  }
  publishAdp(data: AdpImport) {
    return this.repository.publish({
      provider: data.source,
      kind: "adp",
      payloadHash: "pending-" + data.retrievedAt.getTime(),
      source: data.source,
      version: data.retrievedAt.toISOString(),
    });
  }
}
