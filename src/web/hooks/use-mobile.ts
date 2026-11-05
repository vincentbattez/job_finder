import { useEffect, useState } from 'react';

// Below md, the Sidebar opens as a Sheet (DESIGN.md « Layout »): shadcn's hook, held to the lint
const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = globalThis.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(query.matches);
    };
    query.addEventListener('change', onChange);
    onChange();
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);
  return isMobile;
}
