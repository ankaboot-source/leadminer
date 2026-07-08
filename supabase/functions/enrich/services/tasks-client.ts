// TasksClient — Deno/Supabase port of backend/src/db/supabase/tasks.ts.
// Handles CRUD for the `private.tasks` table and provides snake/camel
// mapping between the application `Task` shape and the database row shape.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Logger } from "../../_shared/logger.ts";
import type { SupabaseTask, Task } from "./db-types.ts";

/**
 * Thin wrapper around the `private.tasks` Supabase table. Exposes the same
 * three operations as the backend's `SupabaseTasks` (`getById`, `create`,
 * `update`) with identical snake/camel mapping logic.
 */
export default class TasksClient {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger,
  ) {}

  private static mapToDatabase(task: Task): SupabaseTask {
    const mapped: SupabaseTask = {
      id: task.id,
      user_id: task.userId,
      type: task.type,
      category: task.category,
      details: task.details,
      status: task.status,
      started_at: task.startedAt,
      stopped_at: task.stoppedAt,
      duration: task.duration,
    };
    return mapped;
  }

  private static mapFromDatabase(task: SupabaseTask): Task {
    return {
      id: task.id,
      userId: task.user_id,
      type: task.type,
      category: task.category,
      details: task.details,
      status: task.status,
      startedAt: task.started_at,
      stoppedAt: task.stopped_at,
      duration: task.duration,
    };
  }

  /**
   * Fetch a single task by id. Throws on Supabase error.
   */
  async getById(id: string): Promise<Task> {
    try {
      const { data, error } = await this.client
        .schema("private")
        .from("tasks")
        .select()
        .eq("id", id)
        .single<SupabaseTask>();

      if (error) throw new Error(error.message);
      return TasksClient.mapFromDatabase(data);
    } catch (err) {
      const message = (err as Error).message || "Unexpected error.";
      this.logger.error(`[${this.constructor.name}.getById]: ${message}`);
      throw err;
    }
  }

  /**
   * Insert a new task and return the persisted row (camelCase).
   */
  async create(task: Task): Promise<Task> {
    try {
      const { data, error } = await this.client
        .schema("private")
        .from("tasks")
        .insert(TasksClient.mapToDatabase(task))
        .select()
        .single<SupabaseTask>();

      if (error) throw new Error(error.message);
      return TasksClient.mapFromDatabase(data);
    } catch (err) {
      const message = (err as Error).message || "Unexpected error.";
      this.logger.error(`[${this.constructor.name}.create]: ${message}`);
      throw err;
    }
  }

  /**
   * Update an existing task identified by `task.id` and return the new row.
   */
  async update(task: Task): Promise<Task> {
    try {
      const { data, error } = await this.client
        .schema("private")
        .from("tasks")
        .update(TasksClient.mapToDatabase(task))
        .eq("id", task.id)
        .select()
        .single<SupabaseTask>();

      if (error) throw new Error(error.message);
      return TasksClient.mapFromDatabase(data);
    } catch (err) {
      const message = (err as Error).message || "Unexpected error.";
      this.logger.error(`[${this.constructor.name}.update]: ${message}`);
      throw err;
    }
  }
}
