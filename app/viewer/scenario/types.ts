export type VentMode = "VC" | "PC" | "SIMV" | "PS" | "CPAP";

type ScenarioNoteAction = {
  type: "NOTE";
  message: string;
};

type ScenarioSetFio2Action = {
  type: "SET_FIO2";
  fio2: number;
};

type ScenarioSetPeepAction = {
  type: "SET_PEEP";
  peep: number;
};

type ScenarioSetModeAction = {
  type: "SET_MODE";
  mode: VentMode;
};

export type ScenarioAction =
  | ScenarioNoteAction
  | ScenarioSetFio2Action
  | ScenarioSetPeepAction
  | ScenarioSetModeAction;
