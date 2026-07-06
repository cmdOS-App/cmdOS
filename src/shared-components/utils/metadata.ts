export interface BaseEntity {
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  deleted?: boolean;
  deletedAt?: string;
}

export function createMetadata(): Pick<BaseEntity, 'createdAt' | 'updatedAt' | 'version'> {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function touchEntity(entity: BaseEntity): void {
  entity.updatedAt = new Date().toISOString();
  if (typeof entity.version === 'number') {
    entity.version++;
  } else {
    entity.version = 2;
  }
}

export function hydrateMetadata<T extends Record<string, any>>(entity: T): T & BaseEntity {
  if (!entity) return entity;

  const now = new Date().toISOString();
  const createdAt = entity.createdAt ?? entity.created_at ?? now;
  const updatedAt = entity.updatedAt ?? entity.updated_at ?? createdAt;
  const version = typeof entity.version === 'number' ? entity.version : 1;

  return {
    ...entity,
    createdAt,
    updatedAt,
    version,
  };
}
