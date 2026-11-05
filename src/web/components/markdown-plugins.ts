import remarkGfm from 'remark-gfm';

// GitHub Markdown, as the Sources, the import and the AI write it: tables would otherwise stay raw pipes
export const REMARK_PLUGIN_LIST = [remarkGfm];
