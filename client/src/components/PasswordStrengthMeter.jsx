const estimateStrength = (pw) => {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (pw.length >= 16 && classes >= 3) score = 4;
  const labels = ["Very weak", "Weak", "Okay", "Strong", "Very strong"];
  return { score, label: labels[score] };
};

const segColor = (idx, score) => {
  if (idx >= score) return "bg-bone-strong";
  if (score <= 1) return "bg-st-down";
  if (score === 2) return "bg-st-degraded";
  return "bg-st-up";
};

const PasswordStrengthMeter = ({ password }) => {
  const { score, label } = estimateStrength(password);
  const segments = [0, 1, 2, 3];

  return (
    <div className="mt-2">
      <div className="flex gap-[3px]">
        {segments.map((i) => (
          <div key={i} className={"h-[3px] flex-1 transition-colors " + segColor(i, score)} />
        ))}
      </div>
      {password && (
        <p className="mt-2 text-[11px] font-num uppercase tracking-wider text-muted">
          Strength: <span className="text-ink">{label}</span>
          {score < 2 && (
            <span className="text-st-down"> — requires at least "Okay"</span>
          )}
        </p>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
