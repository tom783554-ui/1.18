export type VentMode = "VC" | "PC" | "SIMV" | "PS" | "CPAP";

export type ScenarioAction =
  | {
      type: "NOTE";
      message: string;
    }
  | {
      type: "SET_FIO2";
      fio2: number;
    }
  | {
      type: "SET_PEEP";
      peep: number;
    }
  | {
      type: "SET_MODE";
      mode: VentMode;
    };
