"use client";

import { useEffect } from "react";
import { getScenarioOptions } from "../engine/scenarioConfig";
import { usePatientEngine } from "../engine/usePatientEngine";

const persistScenario = (scenarioId: string) => {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  params.set("scenario", scenarioId);
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
  window.localStorage.setItem("m3d-scenario", scenarioId);
};

export default function ScenarioMenu() {
  const { state, setScenario } = usePatientEngine();
  const options = getScenarioOptions();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const scenarioFromQuery = params.get("scenario");
    if (scenarioFromQuery && scenarioFromQuery !== state.scenarioId) {
      setScenario(scenarioFromQuery);
    }
  }, [setScenario, state.scenarioId]);

  return (
    <label className="scenario-menu">
      <span className="scenario-label">Scenario</span>
      <select
        value={state.scenarioId}
        onChange={(event) => {
          const scenarioId = event.target.value;
          setScenario(scenarioId);
          persistScenario(scenarioId);
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <style jsx>{`
        .scenario-menu {
          display: grid;
          gap: 4px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(226, 232, 240, 0.7);
        }
        .scenario-label {
          font-size: 10px;
          color: rgba(226, 232, 240, 0.7);
        }
        select {
          appearance: none;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.8);
          color: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          text-transform: none;
          letter-spacing: 0.02em;
          cursor: pointer;
        }
        select:focus {
          outline: 2px solid rgba(56, 189, 248, 0.6);
          outline-offset: 2px;
        }
      `}</style>
    </label>
  );
}
