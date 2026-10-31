// What a form's fetcher reads of the answer of its route: the message of the failure's code that
// relayAction refused it with, absent or null when the action went through (CODING_STANDARDS
// “Visible failure”)
export interface IRefusal {
  error?: string | null;
}

// What relayLoader throws for the error page: the code of the failure, and its message in the
// Candidate's locale. Plain data, since an Error crosses to the browser with its message only.
export interface ILoaderFailure {
  errorCode: string;
  message: string;
}

export function isLoaderFailure(value: unknown): value is ILoaderFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'errorCode' in value &&
    typeof value.errorCode === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
