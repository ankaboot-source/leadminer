import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseTask } from '../types';
import { Task } from '../../services/tasks-manager/types';
import { Tasks } from '../interfaces/Tasks';

export default class SupabaseTasks implements Tasks {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  private static mapToDatabase(task: Task) {
    const mapped: SupabaseTask = {
      id: task.id,
      user_id: task.userId,
      type: task.type,
      category: task.category,
      details: task.details,
      status: task.status,
      stopped_at: task.stoppedAt?.toString(),
      started_at: task.startedAt?.toString(),
      duration: task.duration
    };
    return mapped;
  }

  private static mapFromDatabase(task: SupabaseTask) {
    const mapped: Task = {
      id: task.id,
      userId: task.user_id,
      type: task.type,
      category: task.category,
      details: task.details,
      status: task.status,
      stoppedAt: task.stopped_at,
      startedAt: task.started_at,
      duration: task.duration
    };
    return mapped;
  }

  async getById(id: string) {
    try {
      const { data, error } = await this.client
        .schema('private')
        .from('tasks')
        .select()
        .eq('id', id)
        .single<SupabaseTask>();

      if (error) throw new Error(error.message);
      return SupabaseTasks.mapFromDatabase(data);
    } catch (err) {
      const message = (err as Error).message || 'Unexpected error.';
      this.logger.error(`[${this.constructor.name}.register]: ${message}`);
      throw err;
    }
  }

  /**
   * Inserts one or more tasks in the database.
   *
   * @param tasks - An array of tasks to insert.
   * @returns An array of inserted tasks, or undefined if an error occurred.
   */
  async create(task: Task): Promise<Task> {
    try {
      const { data, error } = await this.client
        .schema('private')
        .from('tasks')
        .insert(SupabaseTasks.mapToDatabase(task))
        .select()
        .single<SupabaseTask>();

      if (error) throw new Error(error.message);
      return SupabaseTasks.mapFromDatabase(data);
    } catch (err) {
      const message = (err as Error).message || 'Unexpected error.';
      this.logger.error(`[${this.constructor.name}.register]: ${message}`);
      throw err;
    }
  }

  async update(task: Task): Promise<Task> {
    try {
      const { data, error } = await this.client
        .schema('private')
        .from('tasks')
        .update(SupabaseTasks.mapToDatabase(task))
        .eq('id', task.id)
        .select()
        .single<SupabaseTask>();

      if (error) throw new Error(error.message);
      return SupabaseTasks.mapFromDatabase(data);
    } catch (err) {
      const message = (err as Error).message || 'Unexpected error.';
      this.logger.error(`[${this.constructor.name}.register]: ${message}`);
      throw err;
    }
  }
}
