import { defaultErrorTranslator } from '#/domain/catalogue/i18n.ts';

// A failure the Candidate can act on, identified by a code that means one thing, whatever its message
// says (#39 grows this catalogue to every failure). The message, in the i18next resources, says what to do.
type ErrorCode =
  'data_layout_mixed' | 'data_layout_unexpected' | 'config_invalid' | 'config_keys_mixed' | 'detection_running';

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
const t = defaultErrorTranslator();

export const ERROR = {
  // An entry of the data folder exists both in the French layout and in the English one
  dataLayoutMixed: (frenchPath: string, englishPath: string) =>
    new CodedError('data_layout_mixed', t('dataLayoutMixed', { frenchPath, englishPath })),
  // A known entry of the French layout is not what the tool expects, a file for a folder or the reverse
  dataLayoutUnexpected: (frenchPath: string) =>
    new CodedError('data_layout_unexpected', t('dataLayoutUnexpected', { frenchPath })),
  // The config an older jf left does not follow the schema it is imported with
  configInvalid: (configPath: string, problem: string) =>
    new CodedError('config_invalid', t('configInvalid', { configPath, problem })),
  // The config an older jf left holds a French key and its English name at once
  configKeysMixed: (configPath: string, frenchKey: string, englishKey: string) =>
    new CodedError('config_keys_mixed', t('configKeysMixed', { configPath, frenchKey, englishKey })),
  // A Detection is asked for while another one runs, the front's or the daily one: one at a time (#63)
  detectionRunning: (startedAt: Date) => new CodedError('detection_running', t('detectionRunning', { startedAt })),
};
