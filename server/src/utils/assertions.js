const evaluateAssertions = (assertions, responseBody, statusCode) => {
  if (!assertions || assertions.length === 0) {
    return { passed: true, results: [] };
  }

  const results = assertions.map((assertion) => {
    try {
      switch (assertion.type) {
        case "body_contains":
          return {
            ...assertion,
            passed: typeof responseBody === "string" && responseBody.includes(assertion.value),
            actual: typeof responseBody === "string" ? "Body length: " + responseBody.length : "Non-string body",
          };

        case "body_not_contains":
          return {
            ...assertion,
            passed: typeof responseBody === "string" && !responseBody.includes(assertion.value),
            actual: typeof responseBody === "string" ? "Body length: " + responseBody.length : "Non-string body",
          };

        case "json_path": {
          let parsed = responseBody;
          if (typeof responseBody === "string") {
            try {
              parsed = JSON.parse(responseBody);
            } catch {
              return {
                ...assertion,
                passed: false,
                actual: "Invalid JSON response",
              };
            }
          }

          const pathParts = assertion.path.replace(/^\$\.?/, "").split(".");
          let current = parsed;

          for (const part of pathParts) {
            if (current === null || current === undefined) {
              return {
                ...assertion,
                passed: false,
                actual: "Path not found",
              };
            }

            const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) {
              current = current[arrayMatch[1]];
              if (Array.isArray(current)) {
                current = current[parseInt(arrayMatch[2])];
              } else {
                return {
                  ...assertion,
                  passed: false,
                  actual: "Not an array at " + arrayMatch[1],
                };
              }
            } else {
              current = current[part];
            }
          }

          const actualValue = typeof current === "object" ? JSON.stringify(current) : String(current);

          switch (assertion.operator) {
            case "equals":
              return {
                ...assertion,
                passed: String(current) === String(assertion.value),
                actual: actualValue,
              };
            case "not_equals":
              return {
                ...assertion,
                passed: String(current) !== String(assertion.value),
                actual: actualValue,
              };
            case "contains":
              return {
                ...assertion,
                passed: actualValue.includes(assertion.value),
                actual: actualValue,
              };
            case "greater_than":
              return {
                ...assertion,
                passed: Number(current) > Number(assertion.value),
                actual: actualValue,
              };
            case "less_than":
              return {
                ...assertion,
                passed: Number(current) < Number(assertion.value),
                actual: actualValue,
              };
            default:
              return {
                ...assertion,
                passed: false,
                actual: "Unknown operator: " + assertion.operator,
              };
          }
        }

        case "response_time":
          return {
            ...assertion,
            passed: true,
            actual: "Evaluated after check",
          };

        case "status_code":
          return {
            ...assertion,
            passed: statusCode === parseInt(assertion.value),
            actual: String(statusCode),
          };

        default:
          return {
            ...assertion,
            passed: false,
            actual: "Unknown assertion type",
          };
      }
    } catch (error) {
      return {
        ...assertion,
        passed: false,
        actual: "Error: " + error.message,
      };
    }
  });

  const allPassed = results.every((r) => r.passed);

  return { passed: allPassed, results };
};

module.exports = { evaluateAssertions };