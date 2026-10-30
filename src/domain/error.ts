import { catalogueOf } from '#/domain/catalogue/index.ts';

// A failure the Candidate can act on, identified by a code that means one thing, whatever its message
// says (#39 grows this catalogue to every failure). The message, in the catalogue, says what to do.
type ErrorCode = 'data_layout_mixed' | 'data_layout_unexpected' | 'config_invalid' | 'config_keys_mixed';

class CodedError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'CodedError';
    this.code = code;
  }
}

// Each code, built with the values of the case into the message that goes with it. It is raised as
// the workspace opens, before any Candidate is known: in the default locale.
const { error: MESSAGE_BY_CODE } = catalogueOf(null);

export const ERROR = {
  // An entry of the data folder exists both in the French layout and in the English one
  dataLayoutMixed: (frenchPath: string, englishPath: string) =>
    new CodedError('data_layout_mixed', MESSAGE_BY_CODE.dataLayoutMixed(frenchPath, englishPath)),
  // A known entry of the French layout is not what the tool expects, a file for a folder or the reverse
  dataLayoutUnexpected: (frenchPath: string) =>
    new CodedError('data_layout_unexpected', MESSAGE_BY_CODE.dataLayoutUnexpected(frenchPath)),
  // The config an older jf left does not follow the schema it is imported with
  configInvalid: (configPath: string, problem: string) =>
    new CodedError('config_invalid', MESSAGE_BY_CODE.configInvalid(configPath, problem)),
  // The config an older jf left holds a French key and its English name at once
  configKeysMixed: (configPath: string, frenchKey: string, englishKey: string) =>
    new CodedError('config_keys_mixed', MESSAGE_BY_CODE.configKeysMixed(configPath, frenchKey, englishKey)),
};
