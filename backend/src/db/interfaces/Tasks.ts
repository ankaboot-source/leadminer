import { SupabaseTask, Task } from '../types';

export interface Tasks {
  create(tasks: Task[]): Promise<SupabaseTask[] | undefined>;
  update(task: Task): Promise<SupabaseTask | undefined>;
}
