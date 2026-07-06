import { useMemo, useState } from 'react';
import { useDbStore } from '../../../../storage/store/useDbStore';

export const useAppData = () => {
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbTodos = useDbStore(state => state.todos);
  const dbAutomations = useDbStore(state => state.automations);
  const [optimisticTodos, setOptimisticTodos] = useState<Record<string, boolean>>({});

  const toggleTodoOptimistic = (id: string, isDone: boolean) => {
    setOptimisticTodos(prev => ({ ...prev, [id]: isDone }));
  };

  const data = useMemo(() => {
    const todos = dbTodos.map((t: any) => {
      const id = String(t.snippet_id || t.id || t.todo_id);
      if (id in optimisticTodos) {
        return { ...t, is_done: optimisticTodos[id] ? 1 : 0 };
      }
      return t;
    });

    return {
      automations: dbAutomations as any[],
      notes: dbNotes as any[],
      snippets: dbSnippets as any[],
      todos,
      links: dbLinks as any[],
      toggleTodoOptimistic,
    };
  }, [dbAutomations, dbLinks, dbNotes, dbSnippets, dbTodos, optimisticTodos]);

  return data;
};
