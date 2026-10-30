// A failure the Candidate can act on, identified by a code that means one thing, whatever its message
// says (#39 grows this catalogue to every failure). The message says what to do.
type ErrorCode = 'data_layout_mixed' | 'data_layout_unexpected';

class CodedError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'CodedError';
    this.code = code;
  }
}

// The catalogue: each code, built with the values of the case into the message that goes with it
export const ERROR = {
  // An entry of the data folder exists both in the French layout and in the English one
  dataLayoutMixed: (frenchPath: string, englishPath: string) =>
    new CodedError(
      'data_layout_mixed',
      `Le dossier de données mélange l'ancienne et la nouvelle disposition : « ${frenchPath} » et « ${englishPath} » existent tous deux. Fusionner le premier dans le second à la main, le supprimer, puis relancer.`,
    ),
  // A known entry of the French layout is not what the tool expects, a file for a folder or the reverse
  dataLayoutUnexpected: (frenchPath: string) =>
    new CodedError(
      'data_layout_unexpected',
      `Le dossier de données a une entrée inattendue : « ${frenchPath} » n'est pas du type que l'outil connaît. La déplacer hors du dossier de données, puis relancer.`,
    ),
};
