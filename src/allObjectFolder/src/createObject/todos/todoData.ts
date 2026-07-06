/**
 * @file todoData.ts
 * @description Handles IndexedDB transactions (CRUD) for Todo records,
 * supporting setting references and updating completion status.
 * 
 * @usage
 * ```ts
 * import { createTodo, updateTodo } from './todoData';
 * const todo = await createTodo('Finish task', [], 'one-time', Date.now());
 * ```
 */

import { generateEntityId } from '../../../../shared-components/utils';

import { db } from '../../../../storage/indexDB/dbConfig';
import type { TodoRecord, TodoReference } from './todoTypes';

export const createTodo = async (
  title: string,
  references: any[],
  scheduleType: 'one-time' | 'recurring',
  scheduleTime: number,
  recurringCycle?: string,
  description?: string
): Promise<TodoRecord> => {
  try {
    const now = Date.now();
    let finalTitle = title;
    
    if (!finalTitle && references?.length) {
       finalTitle = references[0].name || references[0].key || references[0].title || 'Untitled Todo';
    }

    const mappedReferences: TodoReference[] = references.map((ref: any) => ({
      id: String(ref.id || ref.value || ref.snippet_id),
      type: ref.type || ref.category || 'note'
    }));

    const newTodo: TodoRecord = {
      id: generateEntityId('todo'),
      name: finalTitle,
      description,
      references: mappedReferences,
      isDone: false,
      scheduleType,
      recurringType: recurringCycle as any,
      scheduleTime,
      createdAt: now,
      updatedAt: now
    };

    await db.todos.add(newTodo);
    return newTodo;
  } catch (e) {
    console.error('Failed to create todo in Dexie', e);
    throw e;
  }
};

export const deleteTodo = async (todoId: string): Promise<void> => {
  try {
    if (todoId) {
      await db.todos.delete(todoId);
    }
  } catch (e) {
    console.error('Permanent delete failed:', e);
    throw e;
  }
};

export const updateTodo = async (
  todoId: string, 
  newDoneStatus: boolean, 
  nextDeadline?: string
): Promise<void> => {
  try {
    if (todoId) {
      const updates: Partial<TodoRecord> = {
        isDone: newDoneStatus,
        updatedAt: Date.now()
      };
      
      if (nextDeadline) {
        updates.scheduleTime = new Date(nextDeadline).getTime();
      }
      
      await db.todos.update(todoId, updates);
    }
  } catch (e) {
    console.error('Failed to update todo status in Dexie', e);
    throw e;
  }
};
