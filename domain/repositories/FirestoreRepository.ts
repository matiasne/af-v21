export interface FirestoreRepository<T> {
  getById(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  create(data: Omit<T, "id">): Promise<string>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  query(field: string, operator: FirestoreOperator, value: unknown): Promise<T[]>;
}

export type FirestoreOperator =
  | "<"
  | "<="
  | "=="
  | "!="
  | ">="
  | ">"
  | "array-contains"
  | "array-contains-any"
  | "in"
  | "not-in";
