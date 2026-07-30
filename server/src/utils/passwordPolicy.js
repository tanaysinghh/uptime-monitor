const zxcvbn = require("zxcvbn");

const MIN_SCORE = 2;
const MIN_LENGTH = 8;
const MAX_LENGTH = 200;

const evaluatePassword = (password, userInputs = []) => {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return { ok: false, score: 0, reason: `Password must be at least ${MIN_LENGTH} characters.` };
  }
  if (password.length > MAX_LENGTH) {
    return { ok: false, score: 0, reason: `Password must be at most ${MAX_LENGTH} characters.` };
  }

  const result = zxcvbn(password, userInputs.filter(Boolean));
  if (result.score < MIN_SCORE) {
    const feedback =
      result.feedback.warning ||
      (result.feedback.suggestions && result.feedback.suggestions[0]) ||
      "Password is too weak. Try adding more length or unrelated words.";
    return { ok: false, score: result.score, reason: feedback };
  }

  return { ok: true, score: result.score };
};

module.exports = { evaluatePassword, MIN_SCORE, MIN_LENGTH, MAX_LENGTH };
