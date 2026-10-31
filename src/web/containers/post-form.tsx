import type { ReactNode } from 'react';
import { Form } from 'react-router';

// The form a Dumb's fields go in, posted to the action of its page's route, which answers it in its
// action data; the page keeps its scroll
export function renderPostForm(fieldList: ReactNode): ReactNode {
  return (
    <Form method="post" preventScrollReset>
      {fieldList}
    </Form>
  );
}
