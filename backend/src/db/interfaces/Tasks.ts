import { Task } from '../types';

export interface Tasks {
  create(task: Task): Promise<Task | undefined>;
  update(task: Task): Promise<Task | undefined>;
}
