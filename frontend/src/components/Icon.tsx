/** The app's own icon set: simple 24px line drawings, drawn in the text colour, hidden from screen readers (the label is always beside them). */
const PATHS={
  home:'M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10',
  people:'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.3 3.3 0 0 1 0 6.3M18 14.4c2 .7 3.5 2.6 3.5 5.6',
  term:'M4 6h16M4 12h16M4 18h16',
  book:'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM5 17a3 3 0 0 1 3-3h11',
  help:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01',
  history:'M12 21a9 9 0 1 0-8.5-6M3 4v5h5M12 7v5l3 2',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  todo:'M4 4h16v16H4V4ZM8 12l3 3 5-6',
  review:'M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4ZM14 7l3 3',
  calendar:'M4 6h16v14H4V6ZM4 10h16M8 3v4M16 3v4',
  menu:'M4 6h16M4 12h16M4 18h16',
  close:'M6 6l12 12M18 6 6 18',
  more:'M12 5h.01M12 12h.01M12 19h.01',
  grip:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  bell:'M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15L6 17ZM10 21a2 2 0 0 0 4 0',
  quiz:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01',
  activity:'M7 3h8l4 4v14H7V3ZM15 3v4h4M10 13h6M10 17h4',
  exam:'M6 3h12v18H6V3ZM9 8h6M9 12h6M9 16h3',
  material:'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM5 17a3 3 0 0 1 3-3h11',
  announcement:'M3 11v3h3l8 5V6L6 11H3ZM17 9a4 4 0 0 1 0 6',
  check:'M5 12.5l4.5 4.5L19 7.5',
  star:'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z',
  upload:'M12 19V6M6.5 11.5 12 6l5.5 5.5M5 20h14',
  comment:'M4 5h16v11H9l-5 4V5Z',
  search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  inbox:'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z',
  chat:'M4 5h16v11H9l-5 4V5ZM8 9h8M8 12h5',
  school:'M2 9l10-5 10 5-10 5L2 9ZM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6',
  chart:'M4 20V10M10 20V4M16 20v-7M22 20H2',
  link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const;
export type IconName=keyof typeof PATHS;

export function Icon({name,size=24}:{name:IconName;size?:number}){
  return <svg className="icon" aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[name]}/></svg>;
}
