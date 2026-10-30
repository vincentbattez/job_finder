import { codedErrorOf, createActions } from '#/actions/index.ts';

import { createRecordedFetch } from './recorded-http.ts';

// A Detection on the recorded responses in a process of its own, as the daily automation and the
// front's button each are: prints what it found, or the code and message of its failure
const [dataDirectory = ''] = process.argv.slice(2);
const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
try {
  const detectionList = await actions.detect();
  const newReferenceList = detectionList.flatMap(({ newPostingList }) =>
    newPostingList.map(({ reference }) => reference),
  );
  process.stdout.write(JSON.stringify({ newReferenceList }));
} catch (error) {
  const { code, message } = codedErrorOf(error);
  process.stdout.write(JSON.stringify({ code, message }));
}
