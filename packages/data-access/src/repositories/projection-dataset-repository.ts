export interface ProjectionDatasetRecord { id: string; source: string; version: string; publishedAt: Date; }
export interface ProjectionDatasetRepository { findBySourceVersion(source: string, version: string): Promise<ProjectionDatasetRecord | null>; }
