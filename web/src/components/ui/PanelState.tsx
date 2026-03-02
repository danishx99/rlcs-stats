type PanelStateProps = {
  state: "loading" | "error" | "empty";
  message: string;
  onRetry?: () => void;
  className?: string;
};

export default function PanelState({ state, message, onRetry, className = "" }: PanelStateProps) {
  const stateClass = `panel-state panel-state--${state}`;

  return (
    <div
      className={`${stateClass} ${className}`.trim()}
      role={state === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <p>{message}</p>
      {state === "error" && onRetry ? (
        <button type="button" className="ghost panel-state-retry" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
