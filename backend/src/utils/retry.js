
async function withRetry(fn, { maxAttempts = 3, onAttempt = () => {} } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();
    let result;
    let attemptError;
    try {
      result = await fn(attempt);
    } catch (err) {
      attemptError = err;
    }

    const durationMs = Date.now() - startedAt;
    if (!attemptError) {
      await onAttempt({ attempt, success: true, durationMs, result });
      return { success: true, result, attempts: attempt };
    }

    lastError = attemptError;
    const isLastAttempt = attempt === maxAttempts;
    await onAttempt({
      attempt,
      success: false,
      isLastAttempt,
      durationMs,
      error: attemptError,
    });

    if (!isLastAttempt) {
      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 300;
      await new Promise((res) => setTimeout(res, backoffMs));
    }
  }

  return { success: false, error: lastError, attempts: maxAttempts };
}

module.exports = { withRetry };
