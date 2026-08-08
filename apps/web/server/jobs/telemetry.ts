export function jobTelemetry(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ event, service: "draft-sense-jobs", at: new Date().toISOString(), ...fields }));
}
