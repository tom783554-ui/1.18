export type EngineEvent = {
  id: string;
  label: string;
  tSec: number;
};

export type EventLog = {
  capacity: number;
  entries: EngineEvent[];
};

export const createEventLog = (capacity: number): EventLog => ({
  capacity,
  entries: []
});

export const appendEvent = (log: EventLog, event: EngineEvent): EventLog => {
  const entries = log.entries.length >= log.capacity
    ? [...log.entries.slice(1), event]
    : [...log.entries, event];
  return { ...log, entries };
};
