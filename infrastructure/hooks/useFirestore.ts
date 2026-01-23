"use client";

import { useState, useCallback } from "react";

import { FirestoreRepositoryImpl } from "@/infrastructure/repositories/FirestoreRepositoryImpl";
import { FirestoreOperator } from "@/domain/repositories/FirestoreRepository";

export function useFirestore<T extends { id?: string }>(collectionName: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const repository = new FirestoreRepositoryImpl<T>(collectionName);

  const getById = useCallback(
    async (id: string): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await repository.getById(id);

        return result;
      } catch (err) {
        setError(err as Error);

        return null;
      } finally {
        setLoading(false);
      }
    },
    [collectionName],
  );

  const getAll = useCallback(async (): Promise<T[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await repository.getAll();

      return result;
    } catch (err) {
      setError(err as Error);

      return [];
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  const create = useCallback(
    async (data: Omit<T, "id">): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const id = await repository.create(data);

        return id;
      } catch (err) {
        setError(err as Error);

        return null;
      } finally {
        setLoading(false);
      }
    },
    [collectionName],
  );

  const update = useCallback(
    async (id: string, data: Partial<T>): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await repository.update(id, data);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      } finally {
        setLoading(false);
      }
    },
    [collectionName],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await repository.delete(id);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      } finally {
        setLoading(false);
      }
    },
    [collectionName],
  );

  const query = useCallback(
    async (
      field: string,
      operator: FirestoreOperator,
      value: unknown,
    ): Promise<T[]> => {
      setLoading(true);
      setError(null);
      try {
        const result = await repository.query(field, operator, value);

        return result;
      } catch (err) {
        setError(err as Error);

        return [];
      } finally {
        setLoading(false);
      }
    },
    [collectionName],
  );

  return {
    loading,
    error,
    getById,
    getAll,
    create,
    update,
    remove,
    query,
  };
}
