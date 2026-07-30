const estimateStrength = (pw) => {
  if (!pw) return { score: 0, label: "", color: "bg-gray-700" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (pw.length >= 16 && classes >= 3) score = 4;
  const labels = ["Very weak", "Weak", "Okay", "Strong", "Very strong"];
  const colors = ["bg-red-500", "bg-red-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-500"];
  return { score, label: labels[score], color: colors[score] };
};

const PasswordStrengthMeter = ({ password }) => {
  const { score, label, color } = estimateStrength(password);
  const segments = [0, 1, 2, 3];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {segments.map((i) => (
          <div
            key={i}
            className={
              "h-1 flex-1 rounded-full transition-colors " +
              (i < score ? color : "bg-gray-700")
            }
          />
        ))}
      </div>
      {password && (
        <p className="mt-1 text-xs text-gray-400">
          Strength: <span className="font-medium">{label}</span>
          {score < 2 && (
            <span className="text-red-400"> — the server requires at least "Okay".</span>
          )}
        </p>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
