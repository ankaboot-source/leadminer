import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { SupabaseTask, Task } from '../types';
import { Tasks } from '../interfaces/Tasks';

export default class SupabaseTasks implements Tasks {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  /**
   * Inserts or updates one or more tasks in the Supabase database.
   *
   * @param tasks - An array of tasks to insert or update.
   * @returns An array of inserted or updated tasks, or undefined if an error occurred.
   */
  async create(tasks: Task[]): Promise<SupabaseTask[] | undefined> {
    try {
      const taskList: SupabaseTask[] = tasks.map((task) => ({
        user_id: task.userId,
        type: task.type,
        category: task.category,
        details: task.details,
        status: task.status,
        stopped_at: task.stoppedAt?.toString(),
        duration: task.duration
      }));
      const { data, error } = await this.client
        .from('tasks')
        .insert(taskList)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      this.logger.error('Error creating task to Supabase:', error);
      return undefined;
    }
  }

  /**
   * Inserts or updates a task in the Supabase database.
   *
   * @param task - The task to insert or update.
   * @returns The inserted or updated task, or undefined if an error occurred.
   */
  async update(task: Task): Promise<SupabaseTask | undefined> {
    try {
      const { data, error } = await this.client
        .from('tasks')
        .update({
          id: task.id,
          user_id: task.userId,
          type: task.type,
          category: task.category,
          details: task.details,
          status: task.status,
          stopped_at: task.stoppedAt?.toString(),
          duration: task.duration
        } as SupabaseTask)
        .eq('id', task.id)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return data[0];
    } catch (error) {
      this.logger.error('Error updating task to Supabase:', error);
      return undefined;
    }
  }
}
