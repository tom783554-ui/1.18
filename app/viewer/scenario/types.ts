export type VentMode = "VC" | "PC" | "PS" | "SIMV" | "NIV";

export type ScenarioAction =
  | { type: "NOTE"; message: string }
  | { type: "SET_FIO2"; fio2: number }
  | { type: "SET_PEEP"; peep: number }
  | { type: "SET_MODE"; mode: VentMode };
