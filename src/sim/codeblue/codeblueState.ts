export type CodeBlueEngineState = {
  dx: string | null;
  steps: string[];
};

const state: CodeBlueEngineState = {
  dx: null,
  steps: []
};

export const getCodeBlueEngineState = () => state;
