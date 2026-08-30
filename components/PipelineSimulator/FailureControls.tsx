type FailureFlags = {
  partition: boolean;
  consumerOffline: boolean;
  validationHold: boolean;
};

export default function FailureControls({
  failures,
  onTogglePartition,
  onToggleConsumerOffline,
  onInjectPoison,
  onToggleValidationHold,
  onReset,
}: {
  failures: FailureFlags;
  onTogglePartition: () => void;
  onToggleConsumerOffline: () => void;
  onInjectPoison: () => void;
  onToggleValidationHold: () => void;
  onReset: () => void;
}) {
  const buttonBase =
    "font-utility min-h-11 rounded-[4px] border-t border-white/15 px-4 py-3 text-left text-xs tracking-wide uppercase transition-colors duration-150";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button
        type="button"
        onClick={onTogglePartition}
        aria-pressed={failures.partition}
        className={`${buttonBase} ${failures.partition ? "bg-plum text-shell" : "bg-white/[0.06] text-shell/90 hover:bg-white/[0.1]"}`}
      >
        {failures.partition ? "Restore connection" : "Network partition"}
      </button>
      <button
        type="button"
        onClick={onToggleConsumerOffline}
        aria-pressed={failures.consumerOffline}
        className={`${buttonBase} ${failures.consumerOffline ? "bg-plum text-shell" : "bg-white/[0.06] text-shell/90 hover:bg-white/[0.1]"}`}
      >
        {failures.consumerOffline ? "Bring consumer online" : "Consumer offline"}
      </button>
      <button
        type="button"
        onClick={onInjectPoison}
        className={`${buttonBase} bg-white/[0.06] text-shell/90 hover:bg-white/[0.1]`}
      >
        Poison message
      </button>
      <button
        type="button"
        onClick={onToggleValidationHold}
        aria-pressed={failures.validationHold}
        className={`${buttonBase} ${failures.validationHold ? "bg-plum text-shell" : "bg-white/[0.06] text-shell/90 hover:bg-white/[0.1]"}`}
      >
        {failures.validationHold ? "Release hold" : "Validation hold"}
      </button>
      <button
        type="button"
        onClick={onReset}
        className={`${buttonBase} col-span-2 bg-transparent text-graphite hover:text-white sm:col-span-4`}
      >
        Reset to steady state
      </button>
    </div>
  );
}
